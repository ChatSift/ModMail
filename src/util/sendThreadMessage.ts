import { EmbedBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import {
	Attachment,
	ChatInputCommandInteraction,
	Collection,
	Colors,
	GuildMember,
	Message,
	Sticker,
	ThreadChannel,
} from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';

export interface SendThreadMessageOptions {
	content: string;
	stickers?: Collection<string, Sticker> | null;
	attachment?: Attachment | null;
	member: GuildMember;
	userMessage?: Message;
	channel: ThreadChannel;
	staffId?: string | null;
	interaction?: ChatInputCommandInteraction<'cached'>;
	threadId: number;
}

export async function sendThreadMessage({
	content,
	stickers,
	attachment,
	member,
	userMessage,
	channel,
	staffId,
	interaction,
	threadId,
}: SendThreadMessageOptions) {
	const prisma = container.resolve(PrismaClient);

	const noteable = [];

	if (stickers?.size) {
		noteable.push('stickers');
	}

	const embed = new EmbedBuilder()
		.setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
		.setFooter({ text: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() })
		.setColor(staffId ? Colors.Blurple : Colors.Green)
		.setDescription(content)
		.setImage(attachment?.url ?? null);

	if (staffId) {
		try {
			userMessage = await member.send({ embeds: [embed] });
		} catch {
			return channel.send(i18next.t('common.errors.dm_fail'));
		}
	}

	const options = {
		content: noteable.length ? `This message also included: ${noteable.join(', ')}` : undefined,
		embeds: [embed],
	};

	const alerts = await prisma.threadReplyAlert.findMany({ where: { threadId } });

	const message = interaction
		? await interaction.reply({ ...options, fetchReply: true })
		: await channel.send({
				...options,
				content: `${alerts.length ? `Alerts: ${alerts.map((a) => `<@${a.userId}>`).join(' ')}\n` : ''}${
					options.content ?? ''
				}`,
		  });

	const threadMessage = await prisma.threadMessage.create({
		data: {
			guildId: member.guild.id,
			threadId,
			userId: member.user.id,
			userMessageId: userMessage!.id,
			staffId,
			guildMessageId: message.id,
		},
	});

	await message.edit({
		embeds: [
			{
				...embed.toJSON(),
				footer: {
					...embed.toJSON().footer,
					text: `${member.user.tag} (${member.user.id}) | Response id: ${threadMessage.threadMessageId}`,
				},
			},
		],
	});
}
