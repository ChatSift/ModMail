import { type GuildSettings, PrismaClient, type Thread } from '@prisma/client';
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
	type Guild,
	type GuildMember,
	type AnyThreadChannel,
} from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';
import { getSortedMemberRolesString } from './getSortedMemberRoles';

export interface MessageOpenThreadReturn {
	thread: Thread;
	threadChannel: AnyThreadChannel;
	member: GuildMember;
	settings: GuildSettings;
}

export function openThread(
	input: ChatInputCommandInteraction<'cached'> | UserContextMenuCommandInteraction<'cached'>,
): Promise<Message>;

export function openThread(input: Message<false>, definedGuild: Guild): Promise<MessageOpenThreadReturn>;

export async function openThread(
	input: ChatInputCommandInteraction<'cached'> | UserContextMenuCommandInteraction<'cached'> | Message<false>,
	definedGuild?: Guild,
) {
	const prisma = container.resolve(PrismaClient);
	const isMessage = input instanceof Message;
	const guild = isMessage ? definedGuild! : input.guild;

	const send = isMessage
		? (key: string) => input.channel.send(i18next.t(key, { lng: guild.preferredLocale }))
		: (key: string) => input.reply(i18next.t(key, { lng: input.locale }));
	const user =
		'targetUser' in input ? input.targetUser : isMessage ? input.author : input.options.getUser('user', true);

	const settings = await prisma.guildSettings.findFirst({ where: { guildId: guild.id } });
	if (!settings?.modmailChannelId || !guild.channels.cache.has(settings.modmailChannelId)) {
		return send('common.errors.thread_creation');
	}

	const modmail = guild.channels.cache.get(settings.modmailChannelId) as TextChannel;
	const existingThread = await prisma.thread.findFirst({
		where: { guildId: guild.id, userId: user.id, closedById: null },
	});

	const member = await guild.members.fetch(user).catch(() => null);
	if (!member) {
		return send('common.errors.no_member');
	}

	if (existingThread) {
		if (isMessage) {
			return {
				thread: existingThread,
				threadChannel: guild.channels.cache.get(existingThread.channelId),
				member,
				settings,
			};
		}

		return send('common.errors.thread_exists');
	}

	const pastModmails = await prisma.thread.findMany({
		where: { guildId: guild.id, userId: member.id },
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
			const role = guild.roles.cache.get(settings.alertRoleId);
			if (role) {
				alert = `Alert: ${role.toString()}`;
			}
		} else {
			const alerts = await prisma.threadOpenAlert.findMany({ where: { guildId: guild.id } });
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
			guildId: guild.id,
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
