import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	Client,
	Colors,
	EmbedBuilder,
	TextChannel,
	time,
	TimestampStyles,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.open.name'),
		...getLocalizedProp('description', 'commands.open.description'),
		type: ApplicationCommandType.ChatInput,
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.open.options.user.name'),
				...getLocalizedProp('description', 'commands.open.options.user.description'),
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });
		if (!settings?.modmailChannelId || !interaction.guild.channels.cache.has(settings.modmailChannelId)) {
			return interaction.reply(i18next.t('common.errors.thread_creation', { lng: interaction.locale }));
		}

		const modmail = interaction.guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
		const user = interaction.options.getUser('user', true);
		const existingThread = await this.prisma.thread.findFirst({
			where: { guildId: interaction.guild.id, userId: user.id, closedById: null },
		});

		if (existingThread) {
			return interaction.reply(i18next.t('common.errors.thread_exists', { lng: interaction.locale }));
		}

		const member = await interaction.guild.members.fetch(user).catch(() => null);
		if (!member) {
			return interaction.reply(i18next.t('common.errors.no_member', { lng: interaction.locale }));
		}
		const pastModmails = await this.prisma.thread.findMany({
			where: { guildId: interaction.guild.id, createdById: member.id },
		});

		await interaction.deferReply();

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
							inline: true,
						},
						{
							name: i18next.t('thread.start.embed.fields.opened_by'),
							value: interaction.user.toString(),
							inline: true,
						},
						{
							name: i18next.t('thread.start.embed.fields.roles'),
							value: member.roles.cache
								.filter((r) => r.id !== interaction.guild.id)
								.sort((a, b) => b.position - a.position)
								.map((r) => r.toString())
								.join(', '),
							inline: true,
						},
					),
			],
		});

		const threadChannel = await startMessage.startThread({
			name: `${member.user.username}-${member.user.discriminator}`,
		});

		await this.prisma.thread.create({
			data: {
				guildId: interaction.guild.id,
				channelId: threadChannel.id,
				userId: member.id,
				createdById: interaction.user.id,
			},
		});

		return interaction.editReply(i18next.t('common.success.opened_thread', { lng: interaction.locale }));
	}
}
