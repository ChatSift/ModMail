import { Events, Message } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';

@singleton()
export default class implements Event<typeof Events.MessageCreate> {
	public readonly name = Events.MessageCreate;

	public handle(message: Message) {
		if (message.inGuild() || message.author.bot) {
			return;
		}

		// TODO(DD): Look into opening threads
		return 0;
	}
}
