import { PrismaClient } from '@prisma/client';
import { Client, Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';

@singleton()
export default class implements Event<typeof Events.ClientReady> {
	public readonly name = Events.ClientReady;

	public constructor(private readonly prisma: PrismaClient) {}

	private async handleTimedCloses() {
		const threads = await this.prisma.thread.findMany({
			where: { scheduledClose: { isNot: null } },
			include: { scheduledClose: true },
		});

		for (const thread of threads) {
			if (thread.scheduledClose!.closeAt.getTime() >= Date.now()) {
				// TODO(DD): Handle closing
			}
		}
	}

	public handle(client: Client<true>) {
		console.log(`Ready as ${client.user.tag} (${client.user.id})`);
	}
}
