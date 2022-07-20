import { PrismaClient } from '@prisma/client';
import {
	type ChatInputCommandInteraction,
	Colors,
	EmbedBuilder,
	type TextChannel,
	time,
	TimestampStyles,
	type UserContextMenuCommandInteraction,
	Message,
	type MessageOptions,
} from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';
import { getSortedMemberRolesString } from './getSortedMemberRoles';

export async function openThread(
	input: ChatInputCommandInteraction<'cached'> | UserContextMenuCommandInteraction<'cached'> | Message<true>,
) {
	const prisma = container.resolve(PrismaClient);
	const isMessage = input instanceof Message;
	const send = isMessage
		? (key: string) => input.channel.send(i18next.t(key, { lng: input.guild.preferredLocale }))
		: (key: string) => input.reply(i18next.t(key, { lng: input.locale }));
	const user =
		'targetUser' in input ? input.targetUser : isMessage ? input.author : input.options.getUser('user', true);

	const settings = await prisma.guildSettings.findFirst({ where: { guildId: input.guild.id } });
	if (!settings?.modmailChannelId || !input.guild.channels.cache.has(settings.modmailChannelId)) {
		return send('common.errors.thread_creation');
	}

	const modmail = input.guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
	const existingThread = await prisma.thread.findFirst({
		where: { guildId: input.guild.id, userId: user.id, closedById: null },
	});

	if (existingThread) {
		return send('common.errors.thread_exists');
	}

	const member = await input.guild.members.fetch(user).catch(() => null);
	if (!member) {
		return send('common.errors.no_member');
	}
	const pastModmails = await prisma.thread.findMany({
		where: { guildId: input.guild.id, userId: member.id },
	});

	if (!isMessage) {
		await input.deferReply();
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
				name: i18next.t('thread.start.embed.fields.opened_by'),
				value: user.toString(),
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

	const startMessageOptions: MessageOptions = {
		embeds: [embed],
	};

	if (isMessage) {
		embed.spliceFields(3, 1);

		let alert: string | null = null;
		if (settings.alertRoleId) {
			const role = input.guild.roles.cache.get(settings.alertRoleId);
			if (role) {
				alert = `Alert: ${role.toString()}`;
			}
		} else {
			const alerts = await prisma.threadOpenAlert.findMany({ where: { guildId: input.guild.id } });
			alert = alerts.length ? `Alerts: ${alerts.map((a) => `<@${a.userId}>`).join(' ')}` : null;
		}

		startMessageOptions.content = `${member.toString()}${alert ? `\n${alert}` : ''}`;
	} else {
		startMessageOptions.content = member.toString();
	}

	const startMessage = await modmail.send(startMessageOptions);

	const threadChannel = await startMessage.startThread({
		name: `${member.user.username}-${member.user.discriminator}`,
	});

	const thread = await prisma.thread.create({
		data: {
			guildId: input.guild.id,
			channelId: threadChannel.id,
			userId: member.id,
			createdById: user.id,
		},
	});

	if (isMessage) {
		return {
			thread,
			threadChannel,
			member,
			settings,
		};
	}

	return input.editReply(i18next.t('common.success.opened_thread', { lng: input.locale }));
}
