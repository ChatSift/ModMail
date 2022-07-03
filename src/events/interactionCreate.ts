import { AnyInteraction, Events, InteractionType } from 'discord.js';
import { singleton } from 'tsyringe';
import { CommandHandler } from '#struct/CommandHandler';
import type { Event } from '#struct/Event';

@singleton()
export default class implements Event<typeof Events.InteractionCreate> {
	public readonly name = Events.InteractionCreate;

	public constructor(private readonly commandHandler: CommandHandler) {}

	public async handle(interaction: AnyInteraction) {
		switch (interaction.type) {
			case InteractionType.ApplicationCommandAutocomplete: {
				await this.commandHandler.handleAutocomplete(interaction);
				break;
			}

			case InteractionType.MessageComponent: {
				if (interaction.inCachedGuild()) {
					await this.commandHandler.handleMessageComponent(interaction);
				}

				break;
			}

			case InteractionType.ApplicationCommand: {
				await this.commandHandler.handleCommand(interaction);
				break;
			}

			default: {
				console.warn(`Unknown interaction type: ${interaction.type}`);
			}
		}
	}
}
