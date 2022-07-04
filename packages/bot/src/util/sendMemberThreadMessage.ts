import { EmbedBuilder, bold, inlineCode } from '@discordjs/builders';
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
		options.content = `${bold(`${userMessage.author.tag}:`)} ${userMessage.content}${
			userMessage.stickers.size ? ' <sticker>' : ''
		}`;
		if (userMessage.attachments.size) {
			options.files = [userMessage.attachments.first()!];
		}
	} else {
		const embed = new EmbedBuilder()
			.setColor(Colors.Green)
			.setDescription(userMessage.content)
			.setImage(userMessage.attachments.first()?.url ?? null)
			.setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
			.setFooter({ text: `${member.user.tag} (${member.user.id})`, iconURL: member.user.displayAvatarURL() });

		options.content = userMessage.stickers.size ? 'This message also included a sticker' : null;
		options.embeds = [embed];
	}

	if (existing) {
		await channel.send(
			`User edited their message: <${existing.url}>${oldContent ? `\n\nOld content: ${inlineCode(oldContent)}` : ''}`,
		);
		return existing.edit(options);
	}

	const guildMessage = await channel.send(options);

	await prisma.$transaction(async (prisma) => {
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
