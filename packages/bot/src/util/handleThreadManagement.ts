import { PrismaClient } from '@prisma/client';
import {
	type ChatInputCommandInteraction,
	Colors,
	EmbedBuilder,
	type TextChannel,
	time,
	TimestampStyles,
	type UserContextMenuCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';
import { getSortedMemberRolesString } from './getSortedMemberRoles';

export async function handleThreadManagement(
	interaction: ChatInputCommandInteraction<'cached'> | UserContextMenuCommandInteraction<'cached'>,
) {
	const prisma = container.resolve(PrismaClient);
	const user = 'targetUser' in interaction ? interaction.targetUser : interaction.options.getUser('user', true);

	const settings = await prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });
	if (!settings?.modmailChannelId || !interaction.guild.channels.cache.has(settings.modmailChannelId)) {
		return interaction.reply(i18next.t('common.errors.thread_creation', { lng: interaction.locale }));
	}

	const modmail = interaction.guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
	const existingThread = await prisma.thread.findFirst({
		where: { guildId: interaction.guild.id, userId: user.id, closedById: null },
	});

	if (existingThread) {
		return interaction.reply(i18next.t('common.errors.thread_exists', { lng: interaction.locale }));
	}

	const member = await interaction.guild.members.fetch(user).catch(() => null);
	if (!member) {
		return interaction.reply(i18next.t('common.errors.no_member', { lng: interaction.locale }));
	}
	const pastModmails = await prisma.thread.findMany({
		where: { guildId: interaction.guild.id, userId: member.id },
	});

	await interaction.deferReply();

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
				name: i18next.t('thread.start.embed.fields.opened_by'),
				value: interaction.user.toString(),
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
		content: member.toString(),
		embeds: [embed],
	});

	const threadChannel = await startMessage.startThread({
		name: `${member.user.username}-${member.user.discriminator}`,
	});

	await prisma.thread.create({
		data: {
			guildId: interaction.guild.id,
			channelId: threadChannel.id,
			userId: member.id,
			createdById: interaction.user.id,
		},
	});

	return interaction.editReply(i18next.t('common.success.opened_thread', { lng: interaction.locale }));
}
