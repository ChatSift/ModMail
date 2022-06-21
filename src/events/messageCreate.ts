import { PrismaClient } from '@prisma/client';
import {
	ActionRowBuilder,
	Collection,
	ComponentType,
	EmbedBuilder,
	Events,
	Guild,
	Message,
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

@singleton()
export default class implements Event<typeof Events.MessageCreate> {
	public readonly name = Events.MessageCreate;

	public constructor(private readonly prisma: PrismaClient) {}

	private async promptUser(message: Message, guilds: Collection<string, Guild>): Promise<Guild | null> {
		const paginator = new SelectMenuPaginator({ key: 'user-guild-selector', data: [...guilds.values()] });

		let content;
		const actionRow = new ActionRowBuilder<SelectMenuBuilder>();

		const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Guild[]>) => {
			const { data, currentPage, selectMenu, pageLeftOption, pageRightOption } = consumers.asSelectMenu();
			content = `Page ${currentPage}/${paginator.pageCount}`;
			const options: SelectMenuOptionBuilder[] = [];
			if (pageLeftOption) {
				options.push(pageLeftOption);
			}

			options.push(...data.map((guild) => new SelectMenuOptionBuilder().setLabel(guild.name).setValue(guild.id)));

			if (pageRightOption) {
				options.push(pageRightOption);
			}

			selectMenu.setMaxValues(1).setOptions(options);
			actionRow.setComponents([selectMenu]);
		};

		updateMessagePayload(paginator.getCurrentPage());

		const prompt = await message.channel.send({ content, components: [actionRow] });

		for await (const [selectMenu] of message.createMessageComponentCollector<ComponentType.SelectMenu>({
			idle: 30_000,
		})) {
			const [value] = selectMenu.values as [string];
			const isPageBack = value === 'page-left';
			const isPageRight = value === 'page-right';

			if (isPageBack || isPageRight) {
				updateMessagePayload(isPageBack ? paginator.previousPage() : paginator.nextPage());
				await message.edit({ content, components: [actionRow] });
				continue;
			}

			await prompt.delete();
			return guilds.get(value)!;
		}

		await prompt.edit('Timed out...');
		return null;
	}

	// TODO(DD): Embed building
	public async handle(message: Message) {
		if (message.inGuild() || message.author.bot) {
			return;
		}

		const guilds = await getUserGuilds(message.author.id);
		if (!guilds.size) {
			// TODO(DD): Read a locale... somehow
			return message.channel.send(i18next.t('common.errors.no_guilds'));
		}

		const guild = guilds.size === 1 ? guilds.first() : await this.promptUser(message, guilds);
		if (!guild) {
			return;
		}

		const existingThread = await this.prisma.thread.findFirst({
			where: { guildId: guild.id, createdById: message.author.id, closedById: null },
		});

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: guild.id } });
		if (!settings?.modmailChannelId || !guild.channels.cache.has(settings.modmailChannelId)) {
			return message.channel.send(i18next.t('common.errors.thread_creation', { lng: guild.preferredLocale }));
		}

		if (existingThread) {
			const channel = guild.channels.cache.get(existingThread.channelId) as ThreadChannel | undefined;
			if (channel) {
				return channel.send(message.content);
			}

			await message.channel.send(i18next.t('common.errors.no_thread', { lng: guild.preferredLocale }));
		}

		const member = await guild.members.fetch(message.author.id);
		const modmail = guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
		const pastModmails = await this.prisma.thread.findMany({
			where: { guildId: guild.id, createdById: message.author.id },
		});
		const startMessage = await modmail.send({
			embeds: [
				new EmbedBuilder()
					.setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
					.setFooter({ text: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
					.setFields(
						{
							name: i18next.t('thread.start.embed.fields.pronouns'),
							// TODO(DD): ????
							value: 'Noop',
							inline: true,
						},
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
						},
					),
			],
		});

		const threadChannel = await startMessage.startThread({
			name: `${message.author.username}-${message.author.discriminator}`,
		});

		return this.prisma.thread.create({
			data: {
				guildId: guild.id,
				localThreadId: 0, // TODO(DD)
				channelId: threadChannel.id,
				createdById: message.author.id,
			},
		});
	}
}
