import { EmbedBuilder, bold } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { Colors, GuildMember, Message, MessageOptions, ThreadChannel } from 'discord.js';
import { container } from 'tsyringe';

const RECENTLY_ALERTED = new Map<number, Set<string>>();

export interface SendMemberThreadMessageOptions {
	userMessage: Message;
	member: GuildMember;
	channel: ThreadChannel;
	threadId: number;
	simpleMode: boolean;
	oldContent?: string | null;
	existing?: Message;
}

export async function sendMemberThreadMessage({
	userMessage,
	member,
	channel,
	threadId,
	simpleMode,
	oldContent,
	existing,
}: SendMemberThreadMessageOptions) {
	const prisma = container.resolve(PrismaClient);

	const options: Omit<MessageOptions, 'flags'> = {};
	if (simpleMode) {
		if (userMessage.content.length) {
			options.content = `${bold(`${userMessage.author.tag}:`)} ${userMessage.content}${
				userMessage.stickers.size ? ' <sticker>' : ''
			}`;
		}
		if (userMessage.attachments.size) {
			options.files = [userMessage.attachments.first()!];
		}
	} else {
		const embed = new EmbedBuilder()
			.setColor(Colors.Green)
			.setDescription(userMessage.content.length ? userMessage.content : null)
			.setImage(userMessage.attachments.first()?.url ?? null)
			.setFooter({ text: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() });

		if (member.nickname) {
			embed.setAuthor({ name: member.nickname, iconURL: member.displayAvatarURL() });
		}

		options.content = userMessage.stickers.size ? 'This message also included a sticker' : null;
		options.embeds = [embed];
	}

	if (existing) {
		await channel.send({
			content: `**User edited their message:**\n\`Original message\`: ${
				oldContent ?? '[failed to resolve]'
			}\n\`Edited message\`: ${userMessage.content}`,
			reply: { messageReference: existing },
		});
		return existing.edit(options);
	}

	const guildMessage = await channel.send(options);

	const { lastLocalThreadMessageId: localThreadMessageId } = await prisma.thread.update({
		data: {
			lastLocalThreadMessageId: { increment: 1 },
		},
		where: { threadId },
	});

	await prisma.threadMessage.create({
		data: {
			guildId: member.guild.id,
			localThreadMessageId,
			threadId,
			userId: member.user.id,
			userMessageId: userMessage.id,
			guildMessageId: guildMessage.id,
		},
	});

	const alerts = await prisma.threadReplyAlert.findMany({ where: { threadId } });
	if (alerts.length) {
		let recentlyAlerted = RECENTLY_ALERTED.get(threadId);
		if (!recentlyAlerted) {
			recentlyAlerted = new Set();
			RECENTLY_ALERTED.set(threadId, recentlyAlerted);
		}

		const toAlert: string[] = [];
		for (const alert of alerts) {
			if (!recentlyAlerted.has(alert.userId)) {
				toAlert.push(`<@${alert.userId}>`);
				recentlyAlerted.add(alert.userId);
				setTimeout(() => recentlyAlerted!.delete(alert.userId), 30_000).unref();
			}
		}

		if (toAlert.length) {
			await channel.send(`📢 ${toAlert.join(', ')}`);
		}
	}
}
