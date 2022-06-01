import { Events, Interaction } from 'discord.js';
import type { Event } from '../struct/Event';

export default class implements Event<typeof Events.InteractionCreate> {
	public readonly name = Events.InteractionCreate;

	public handle(interaction: Interaction) {
		// TODO(DD)
		return interaction;
	}
}
