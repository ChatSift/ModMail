import { AnyInteraction, Events, InteractionType } from 'discord.js';
import { singleton } from 'tsyringe';
import { CommandHandler } from '#struct/CommandHandler';
import type { Event } from '#struct/Event';

@singleton()
export default class implements Event<typeof Events.InteractionCreate> {
	public readonly name = Events.InteractionCreate;

	public constructor(private readonly commandHandler: CommandHandler) {}

	public handle(interaction: AnyInteraction) {
		if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
			return this.commandHandler.handleAutocomplete(interaction);
		}

		if (interaction.type === InteractionType.MessageComponent) {
			if (!interaction.inCachedGuild()) {
				return;
			}

			return this.commandHandler.handleMessageComponent(interaction);
		}

		if (interaction.type === InteractionType.ApplicationCommand) {
			return this.commandHandler.handleCommand(interaction);
		}

		console.warn(`Unknown interaction type: ${interaction.type}`);
	}
}
