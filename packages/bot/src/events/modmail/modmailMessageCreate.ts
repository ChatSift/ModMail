import { ms } from '@naval-base/ms';
import { PrismaClient } from '@prisma/client';
import {
	ActionRowBuilder,
	bold,
	Client,
	Collection,
	Colors,
	ComponentType,
	EmbedBuilder,
	Events,
	Guild,
	Message,
	MessageOptions,
	SelectMenuBuilder,
	SelectMenuOptionBuilder,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';
import { SelectMenuPaginator, SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { getUserGuilds } from '#util/getUserGuilds';
import { openThread } from '#util/handleThreadManagement';
import { sendMemberThreadMessage } from '#util/sendMemberThreadMessage';
import { templateDataFromMember, templateString } from '#util/templateString';

@singleton()
export default class implements Event<typeof Events.MessageCreate> {
	private readonly userSelectionCache = new Collection<string, string>();
	private readonly recentlyInCache = new Set<string>();

	public readonly name = Events.MessageCreate;

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client<true>) {}

	public overwriteUserSelection(userId: string, guildId: string) {
		this.userSelectionCache.set(userId, guildId);
		setTimeout(() => {
			this.userSelectionCache.delete(userId);
			this.recentlyInCache.add(userId);
		}, ms('24h')).unref();
	}

	private async promptUser(message: Message, guilds: Collection<string, Guild>): Promise<Guild | null> {
		if (this.userSelectionCache.has(message.author.id)) {
			const guildId = this.userSelectionCache.get(message.author.id)!;
			const guild = guilds.get(guildId);
			if (guild) {
				return guild;
			}

			this.userSelectionCache.delete(message.author.id);
		}

		const paginator = new SelectMenuPaginator({ key: 'user-guild-selector', data: [...guilds.values()] });

		const actionRow = new ActionRowBuilder<SelectMenuBuilder>();
		let content = '';

		const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Guild[]>) => {
			const { data, currentPage, selectMenu, pageLeftOption, pageRightOption } = consumers.asSelectMenu();
			content = `${i18next.t(
				this.recentlyInCache.has(message.author.id) ? 'thread.reprompt' : 'thread.prompt',
			)} - Page ${currentPage}/${paginator.pageCount}`;
			const options: SelectMenuOptionBuilder[] = [];
			if (pageLeftOption) {
				options.push(pageLeftOption);
			}

			options.push(...data.map((guild) => new SelectMenuOptionBuilder().setLabel(guild.name).setValue(guild.id)));

			if (pageRightOption) {
				options.push(pageRightOption);
			}

			// Shouldn't need to map - waiting for upstream fix https://github.com/discordjs/discord.js/pull/8174
			selectMenu.setMaxValues(1).setOptions(options.map((o) => o.toJSON()));
			actionRow.setComponents([selectMenu]);
		};

		updateMessagePayload(paginator.getCurrentPage());

		const prompt = await message.channel.send({ content, components: [actionRow] });

		for await (const [selectMenu] of prompt.createMessageComponentCollector<ComponentType.SelectMenu>({
			idle: 30_000,
		})) {
			const [value] = selectMenu.values as [string];
			const isPageBack = value === 'page-left';
			const isPageRight = value === 'page-right';

			if (isPageBack || isPageRight) {
				updateMessagePayload(isPageBack ? paginator.previousPage() : paginator.nextPage());
				await selectMenu.update({ content, components: [actionRow] });
				continue;
			}

			await prompt.delete();
			this.overwriteUserSelection(message.author.id, value);
			return guilds.get(value)!;
		}

		await prompt.edit({ content: 'Timed out...', embeds: [], components: [] });
		return null;
	}

	public async handle(message: Message) {
		if (message.inGuild() || message.author.bot) {
			return;
		}

		const guilds = await getUserGuilds(message.author.id);
		if (!guilds.size) {
			return message.channel.send(i18next.t('common.errors.no_guilds'));
		}

		const guild = guilds.size === 1 ? guilds.first() : await this.promptUser(message, guilds);
		if (!guild) {
			return;
		}

		const block = await this.prisma.block.findFirst({ where: { guildId: guild.id, userId: message.author.id } });
		if (block) {
			return;
		}

		const threadResults = await openThread(message as Message<false>, guild);

		if (!('settings' in threadResults)) {
			return;
		}

		const { settings, member, thread, threadChannel } = threadResults;

		await sendMemberThreadMessage({
			userMessage: message,
			member,
			channel: threadChannel,
			threadId: thread.threadId,
			simpleMode: settings.simpleMode,
		});

		if (settings.greetingMessage) {
			const options: MessageOptions = { allowedMentions: { roles: [] } };
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
	}
}
