import { EventEmitter, on } from 'node:events';
import { setTimeout } from 'node:timers';
import { PrismaClient, type Threadv2 } from '@prisma/client';
import type { Message } from 'discord.js';
import { singleton } from 'tsyringe';
import { logger } from '../util/logger.js';

interface ModMailChannelEmitter extends EventEmitter {
	emit(event: 'message', message: Message, thread: Threadv2): boolean;
	on(event: 'message', listener: (message: Message, thread: Threadv2) => void): this;
}

declare module 'node:events' {
	class EventEmitter {
		public static on(
			eventEmitter: ModMailChannelEmitter,
			eventName: 'message',
		): AsyncIterableIterator<[Message, Threadv2]>;
	}
}

@singleton()
export class ModMailHandler {
	private readonly emitters = new Map<string, ModMailChannelEmitter>();

	public handle(message: Message, thread: Threadv2): void {
		const emitter = this.assertEmitter(message);
		emitter.emit('message', message, thread);
	}

	private assertEmitter(message: Message): ModMailChannelEmitter {
		if (this.emitters.has(message.channel.id)) {
			return this.emitters.get(message.channel.id)!;
		}

		const emitter: ModMailChannelEmitter = new EventEmitter().setMaxListeners(1);
		const timeout = setTimeout(() => {
			emitter.removeAllListeners();
			this.emitters.delete(message.channel.id);
		}, 60_000).unref();

		void this.setupHandler(emitter, timeout);

		this.emitters.set(message.channel.id, emitter);
		return emitter;
	}

	private async setupHandler(emitter: ModMailChannelEmitter, timeout: NodeJS.Timeout): Promise<void> {
		for await (const [message, thread] of on(emitter, 'message')) {
			timeout.refresh();
			await this.handleUserMessage(message, thread);
		}
	}

	private async handleUserMessage(message: Message, thread: Threadv2): Promise<void> {
		logger.debug('Handling user message', { message, thread });
	}
}
