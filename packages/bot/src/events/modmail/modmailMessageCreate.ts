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
	TextChannel,
	ThreadChannel,
	time,
	TimestampStyles,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';
import { SelectMenuPaginator, SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { getSortedMemberRolesString } from '#util/getSortedMemberRoles';
import { getUserGuilds } from '#util/getUserGuilds';
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

			await message.channel.send(i18next.t('common.errors.thread_deleted', { lng: guild.preferredLocale }));
		}

		const modmail = guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
		const pastModmails = await this.prisma.thread.findMany({
			where: { guildId: guild.id, userId: message.author.id },
		});

		let alert: string | null = null;
		if (settings.alertRoleId) {
			const role = guild.roles.cache.get(settings.alertRoleId);
			if (role) {
				alert = `Alert: ${role.toString()}`;
			}
		} else {
			const alerts = await this.prisma.threadOpenAlert.findMany({ where: { guildId: guild.id } });
			alert = alerts.length ? `Alerts: ${alerts.map((a) => `<@${a.userId}>`).join(' ')}` : null;
		}

		const embed = new EmbedBuilder()
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
					value: getSortedMemberRolesString(member),
					inline: true,
				},
			);

		if (member.nickname) {
			embed.setAuthor({ name: member.nickname, iconURL: member.displayAvatarURL() });
		}

		const startMessage = await modmail.send({
			content: `${member.toString()}${alert ? `\n${alert}` : ''}`,
			embeds: [embed],
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
