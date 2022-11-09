import { setTimeout } from 'node:timers';
import { PrismaClient } from '@prisma/client';
import { AsyncQueue } from '@sapphire/async-queue';
import type { Collection, ComponentType, Guild, Message, MessageCreateOptions, SelectMenuBuilder } from 'discord.js';
import { ActionRowBuilder, bold, Client, Colors, EmbedBuilder, Events, SelectMenuOptionBuilder } from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { logger } from '../../util/logger';
import type { Event } from '#struct/Event';
import type { SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { SelectMenuPaginator } from '#struct/SelectMenuPaginator';
import { getUserGuilds } from '#util/getUserGuilds';
import { openThread } from '#util/handleThreadManagement';
import { sendMemberThreadMessage } from '#util/sendMemberThreadMessage';
import { templateDataFromMember, templateString } from '#util/templateString';

@singleton()
export default class implements Event<typeof Events.MessageCreate> {
	private readonly queues = new Map<string, AsyncQueue>();

	private readonly queueTimeouts = new Map<string, NodeJS.Timeout>();

	public readonly name = Events.MessageCreate;

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client<true>) {}

	private async promptUser(message: Message, guilds: Collection<string, Guild>): Promise<Guild | null> {
		const paginator = new SelectMenuPaginator({
			key: 'user-guild-selector',
			data: [...guilds.values()],
		});

		const actionRow = new ActionRowBuilder<SelectMenuBuilder>();
		let content = '';

		const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Guild[]>) => {
			const { data, currentPage, selectMenu, pageLeftOption, pageRightOption } = consumers.asSelectMenu();
			content = `${i18next.t('thread.prompt')} - Page ${currentPage + 1}/${paginator.pageCount}`;
			const options: SelectMenuOptionBuilder[] = [];
			if (pageLeftOption) {
				options.push(pageLeftOption);
			}

			options.push(...data.map((guild) => new SelectMenuOptionBuilder().setLabel(guild.name).setValue(guild.id)));

			if (pageRightOption) {
				options.push(pageRightOption);
			}

			logger.debug(options);
			selectMenu.setMaxValues(1).setOptions(options);
			actionRow.setComponents([selectMenu]);
		};

		updateMessagePayload(paginator.getCurrentPage());

		const prompt = await message.channel.send({
			content,
			components: [actionRow],
		});

		for await (const [selectMenu] of prompt.createMessageComponentCollector<ComponentType.SelectMenu>({
			idle: 30_000,
		})) {
			const [value] = selectMenu.values as [string];
			const isPageBack = value === 'page-left';
			const isPageRight = value === 'page-right';

			if (isPageBack || isPageRight) {
				updateMessagePayload(isPageBack ? paginator.previousPage() : paginator.nextPage());
				await selectMenu.update({
					content,
					components: [actionRow],
				});
				continue;
			}

			await prompt.delete();
			return guilds.get(value)!;
		}

		await prompt.edit({
			content: 'Timed out...',
			embeds: [],
			components: [],
		});
		return null;
	}

	private getQueue(userId: string): { queue: AsyncQueue; timeout: NodeJS.Timeout } {
		const queue = this.queues.get(userId);
		if (queue) {
			const queueTimeout = this.queueTimeouts.get(userId)!;
			return {
				queue,
				timeout: queueTimeout,
			};
		}

		const newQueue = new AsyncQueue();
		this.queues.set(userId, newQueue);

		const timeout = setTimeout(() => {
			this.queues.delete(userId);
			this.queueTimeouts.delete(userId);
		}).unref();
		this.queueTimeouts.set(userId, timeout);

		return {
			queue: newQueue,
			timeout,
		};
	}

	public async handle(message: Message) {
		if (message.inGuild() || message.author.bot) {
			return;
		}

		const guilds = await getUserGuilds(message.author.id);
		if (!guilds.size) {
			await message.channel.send(i18next.t('common.errors.no_guilds'));
			return;
		}

		const guild = guilds.size === 1 ? guilds.first() : await this.promptUser(message, guilds);
		if (!guild) {
			return;
		}

		const block = await this.prisma.block.findFirst({
			where: {
				guildId: guild.id,
				userId: message.author.id,
			},
		});
		if (block) {
			return;
		}

		const { queue, timeout } = this.getQueue(message.author.id);
		timeout.refresh();

		try {
			await queue.wait();
			const threadResults = await openThread(message as Message<false>, guild);

			if (!('settings' in threadResults)) {
				return;
			}

			const { settings, member, thread, threadChannel, existing } = threadResults;

			await sendMemberThreadMessage({
				userMessage: message,
				member,
				channel: threadChannel,
				threadId: thread.threadId,
				simpleMode: settings.simpleMode,
			});

			if (existing) {
				return;
			}

			if (settings.greetingMessage) {
				const options: MessageCreateOptions = { allowedMentions: { roles: [] } };
				const templateData = templateDataFromMember(member);
				if (settings.simpleMode) {
					options.content = `⚙️ ${bold(`${guild.name} Staff:`)} ${templateString(
						settings.greetingMessage,
						templateData,
					)}`;
				} else {
					const greetingEmbed = new EmbedBuilder()
						.setAuthor({
							name: i18next.t('thread.greeting.embed.author', {
								guild: guild.name,
								iconURL: member.guild.iconURL() ?? undefined,
							}),
							iconURL: this.client.user.displayAvatarURL(),
						})
						.setDescription(templateString(settings.greetingMessage, templateData))
						.setColor(Colors.NotQuiteBlack);
					options.embeds = [greetingEmbed];
				}

				await message.channel.send(options);
				await threadChannel.send(options);
			}
			// eslint-disable-next-line no-useless-catch
		} catch (error) {
			throw error;
		} finally {
			queue.shift();
		}
	}
}
