import { Client, Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';

@singleton()
export default class implements Event<typeof Events.ClientReady> {
	public readonly name = Events.ClientReady;

	public handle(client: Client<true>) {
		console.log(`Ready as ${client.user.tag} (${client.user.id})`);
	}
}
