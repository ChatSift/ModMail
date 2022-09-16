import { PrismaClient } from "@prisma/client";
import type { Message, PartialMessage, ThreadChannel } from "discord.js";
import { Client, Events } from "discord.js";
import { singleton } from "tsyringe";
import type { Event } from "#struct/Event";

@singleton()
export default class implements Event<typeof Events.MessageDelete> {
	public readonly name = Events.MessageDelete;

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client<true>) {}

	public async handle(message: Message | PartialMessage) {
		if (message.inGuild() || message.author?.bot) {
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
		const channel = (await guild?.channels
			.fetch(threadMessage.thread.channelId)
			.catch(() => null)) as ThreadChannel | null;

		if (!channel) {
			return;
		}

		const existing = await channel.messages.fetch(threadMessage.guildMessageId);
		await channel.send({
			content: "User deleted their message",
			reply: { messageReference: existing },
		});
	}
}
