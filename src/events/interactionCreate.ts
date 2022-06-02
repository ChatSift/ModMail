import { Events, Interaction } from 'discord.js';
import { singleton } from 'tsyringe';
import { CommandHandler } from '#struct/CommandHandler';
import type { Event } from '#struct/Event';

@singleton()
export default class implements Event<typeof Events.InteractionCreate> {
	public readonly name = Events.InteractionCreate;

	public constructor(private readonly commandHandler: CommandHandler) {}

	public handle(interaction: Interaction) {
		if (!interaction.inCachedGuild()) {
			return;
		}

		if (interaction.isAutocomplete()) {
			return this.commandHandler.handleAutocomplete(interaction);
		}

		if (interaction.isMessageComponent()) {
			return this.commandHandler.handleMessageComponent(interaction);
		}

		if (interaction.isCommand()) {
			return this.commandHandler.handleCommand(interaction);
		}

		console.warn(`Unknown interaction type: ${interaction.type}`);
	}
}
