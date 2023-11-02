import { PrismaClient } from '@prisma/client';
import type { Message, PartialMessage, ThreadChannel } from 'discord.js';
import { Client, Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';
import { sendMemberThreadMessage } from '#util/sendMemberThreadMessage';

@singleton()
export default class implements Event<typeof Events.MessageUpdate> {
	public readonly name = Events.MessageUpdate;

	public constructor(
		private readonly prisma: PrismaClient,
		private readonly client: Client<true>,
	) {}

	public async handle(old: Message | PartialMessage, message: Message | PartialMessage) {
		// eslint-disable-next-line no-param-reassign
		message = await message.fetch();

		if (message.inGuild() || message.author.bot || old.content === message.content) {
			return;
		}

		const threadMessage = await this.prisma.threadMessage.findFirst({
			where: { userMessageId: message.id },
			include: { thread: true },
		});
		if (!threadMessage || threadMessage.thread.closedAt) {
			return;
		}

		const guild = this.client.guilds.cache.get(threadMessage.guildId);
		const member = await guild?.members.fetch(message.author.id).catch(() => null);
		const channel = (await guild?.channels
			.fetch(threadMessage.thread.channelId)
			.catch(() => null)) as ThreadChannel | null;

		if (!member || !channel) {
			return;
		}

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: member.guild.id } });
		const existing = await channel.messages.fetch(threadMessage.guildMessageId);

		await sendMemberThreadMessage({
			userMessage: message,
			member,
			channel,
			threadId: threadMessage.threadId,
			simpleMode: settings?.simpleMode ?? false,
			oldContent: old.content,
			existing,
		});
	}
}
