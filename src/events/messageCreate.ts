import { PrismaClient } from '@prisma/client';
import {
	ActionRowBuilder,
	Client,
	Collection,
	Colors,
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
import { sendThreadMessage } from '#util/sendThreadMessage';

@singleton()
export default class implements Event<typeof Events.MessageCreate> {
	public readonly name = Events.MessageCreate;

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client<true>) {}

	private async promptUser(message: Message, guilds: Collection<string, Guild>): Promise<Guild | null> {
		const paginator = new SelectMenuPaginator({ key: 'user-guild-selector', data: [...guilds.values()] });

		const actionRow = new ActionRowBuilder<SelectMenuBuilder>();
		const embed = new EmbedBuilder().setTitle(i18next.t('thread.prompt.embed.title'));

		const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Guild[]>) => {
			const { data, currentPage, selectMenu, pageLeftOption, pageRightOption } = consumers.asSelectMenu();
			embed.setDescription(`Page ${currentPage}/${paginator.pageCount}`);
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

		const prompt = await message.channel.send({ embeds: [embed], components: [actionRow] });

		for await (const [selectMenu] of message.createMessageComponentCollector<ComponentType.SelectMenu>({
			idle: 30_000,
		})) {
			const [value] = selectMenu.values as [string];
			const isPageBack = value === 'page-left';
			const isPageRight = value === 'page-right';

			if (isPageBack || isPageRight) {
				updateMessagePayload(isPageBack ? paginator.previousPage() : paginator.nextPage());
				await message.edit({ embeds: [embed], components: [actionRow] });
				continue;
			}

			await prompt.delete();
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

		const member = await guild.members.fetch(message.author.id);
		const existingThread = await this.prisma.thread.findFirst({
			where: { guildId: guild.id, recipientId: message.author.id, closedById: null },
		});

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: guild.id } });
		if (!settings?.modmailChannelId || !guild.channels.cache.has(settings.modmailChannelId)) {
			return message.channel.send(i18next.t('common.errors.thread_creation', { lng: guild.preferredLocale }));
		}

		if (existingThread) {
			const channel = guild.channels.cache.get(existingThread.channelId) as ThreadChannel | undefined;
			if (channel) {
				return sendThreadMessage({
					content: message.content,
					stickers: message.stickers,
					attachment: message.attachments.first(),
					member,
					channel,
					staff: false,
				});
			}

			await message.channel.send(i18next.t('common.errors.no_thread', { lng: guild.preferredLocale }));
		}

		const modmail = guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
		const pastModmails = await this.prisma.thread.findMany({
			where: { guildId: guild.id, createdById: message.author.id },
		});

		const startMessage = await modmail.send({
			content: member.toString(),
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
						},
					),
			],
		});

		const threadChannel = await startMessage.startThread({
			name: `${message.author.username}-${message.author.discriminator}`,
		});

		await this.prisma.thread.create({
			data: {
				guildId: guild.id,
				channelId: threadChannel.id,
				recipientId: message.author.id,
				createdById: message.author.id,
			},
		});

		await sendThreadMessage({
			content: message.content,
			stickers: message.stickers,
			attachment: message.attachments.first(),
			member,
			channel: threadChannel,
			staff: false,
		});

		if (settings.greetingMessage) {
			const greetingEmbed = new EmbedBuilder()
				.setAuthor({
					name: i18next.t('thread.greeting.embed.author'),
					iconURL: this.client.user.displayAvatarURL(),
				})
				.setDescription(settings.greetingMessage)
				.setColor(Colors.NotQuiteBlack);

			await message.channel.send({ embeds: [greetingEmbed] });
			await threadChannel.send({ embeds: [greetingEmbed] });
		}
	}
}
