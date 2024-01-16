import { PrismaClient } from '@prisma/client';
import type { Message } from 'discord.js';
import { Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '../../struct/Event.js';
import { ModMailHandler } from '../../struct/ModMailHandler.js';

@singleton()
export default class implements Event<typeof Events.MessageCreate> {
	public readonly name = Events.MessageCreate;

	public constructor(
		private readonly modMailHandler: ModMailHandler,
		private readonly prisma: PrismaClient,
	) {}

	public async handle(message: Message) {
		if (!message.channel.isThread()) {
			return;
		}

		const thread = await this.prisma.threadv2.findFirst({
			where: {
				userEndThreadId: message.channel.id,
				closed: false,
			},
		});

		if (!thread) {
			return null;
		}

		this.modMailHandler.handle(message, thread);
	}
}
