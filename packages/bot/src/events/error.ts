import { Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';
import { logger } from '#util/logger';

@singleton()
export default class implements Event<typeof Events.Error> {
	public readonly name = Events.Error;

	public handle(error: Error) {
		logger.error(error);
	}
}
