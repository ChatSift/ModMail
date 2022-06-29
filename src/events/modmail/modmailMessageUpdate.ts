import { PrismaClient } from '@prisma/client';
import { Client, Events, Message, PartialMessage } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';
import { editThreadMessage } from '#util/editThreadMessage';

@singleton()
export default class implements Event<typeof Events.MessageUpdate> {
	public readonly name = Events.MessageUpdate;

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client<true>) {}

	public async handle(_: Message | PartialMessage, message: Message | PartialMessage) {
		message = await message.fetch();

		if (message.inGuild() || message.author.bot) {
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
		const member = await guild?.members.fetch(message.author.id);

		if (!member) {
			return;
		}

		await editThreadMessage({
			threadMessage,
			content: message.content,
			attachment: message.attachments.first(),
			member,
		});
	}
}
