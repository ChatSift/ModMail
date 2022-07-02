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
	TextChannel,
	ThreadChannel,
	time,
	TimestampStyles,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';
import { SelectMenuPaginator, SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { getUserGuilds } from '#util/getUserGuilds';
import { sendMemberThreadMessage } from '#util/sendMemberThreadMessage';

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
		}, 180_000).unref();
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

		const member = await guild.members.fetch(message.author.id);
		const existingThread = await this.prisma.thread.findFirst({
			where: { guildId: guild.id, userId: message.author.id, closedById: null },
		});

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: guild.id } });
		if (!settings?.modmailChannelId || !guild.channels.cache.has(settings.modmailChannelId)) {
			return message.channel.send(i18next.t('common.errors.thread_creation', { lng: guild.preferredLocale }));
		}

		if (existingThread) {
			const channel = guild.channels.cache.get(existingThread.channelId) as ThreadChannel | undefined;
			if (channel) {
				return sendMemberThreadMessage({
					userMessage: message,
					member,
					channel,
					threadId: existingThread.threadId,
					simpleMode: settings.simpleMode,
				});
			}

			await message.channel.send(i18next.t('common.errors.no_thread', { lng: guild.preferredLocale }));
		}

		const modmail = guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
		const pastModmails = await this.prisma.thread.findMany({
			where: { guildId: guild.id, createdById: message.author.id },
		});
		const alerts = await this.prisma.threadOpenAlert.findMany({ where: { guildId: guild.id } });

		const startMessage = await modmail.send({
			content: `${member.toString()}${
				alerts.length ? `\nAlerts: ${alerts.map((a) => `<@${a.userId}>`).join(' ')}` : ''
			}`,
			embeds: [
				new EmbedBuilder()
					.setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
					.setFooter({ text: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
					.setColor(Colors.NotQuiteBlack)
					.setFields(
						{
							name: i18next.t('thread.start.embed.fields.account_created'),
							value: time(member.user.createdAt, TimestampStyles.LongDate),
							inline: true,
						},
						{
							name: i18next.t('thread.start.embed.fields.joined_server'),
							value: time(member.joinedAt!, TimestampStyles.LongDate),
							inline: true,
						},
						{
							name: i18next.t('thread.start.embed.fields.past_modmails'),
							value: pastModmails.length.toString(),
							inline: true,
						},
						{
							name: i18next.t('thread.start.embed.fields.roles'),
							value: member.roles.cache
								.filter((r) => r.id === guild.id)
								.sort((a, b) => b.position - a.position)
								.map((r) => r.toString())
								.join(', '),
							inline: true,
						},
					),
			],
		});

		const threadChannel = await startMessage.startThread({
			name: `${message.author.username}-${message.author.discriminator}`,
		});

		const thread = await this.prisma.thread.create({
			data: {
				guildId: guild.id,
				channelId: threadChannel.id,
				userId: message.author.id,
				createdById: message.author.id,
			},
		});

		await sendMemberThreadMessage({
			userMessage: message,
			member,
			channel: threadChannel,
			threadId: thread.threadId,
			simpleMode: settings.simpleMode,
		});

		if (settings.greetingMessage) {
			const options: MessageOptions = {};
			if (settings.simpleMode) {
				options.content = `⚙️ ${bold(`${guild.name} Staff:`)} ${settings.greetingMessage}`;
			} else {
				const greetingEmbed = new EmbedBuilder()
					.setAuthor({
						name: i18next.t('thread.greeting.embed.author', {
							guild: guild.name,
							iconURL: member.guild.iconURL() ?? undefined,
						}),
						iconURL: this.client.user.displayAvatarURL(),
					})
					.setDescription(settings.greetingMessage)
					.setColor(Colors.NotQuiteBlack);
				options.embeds = [greetingEmbed];
			}

			await message.channel.send(options);
			await threadChannel.send(options);
		}
	}
}
