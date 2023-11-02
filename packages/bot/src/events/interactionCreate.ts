import type { Interaction } from 'discord.js';
import { Events, InteractionType } from 'discord.js';
import { singleton } from 'tsyringe';
import { CommandHandler } from '../struct/CommandHandler.js';
import type { Event } from '../struct/Event.js';
import { logger } from '../util/logger.js';

@singleton()
export default class implements Event<typeof Events.InteractionCreate> {
	public readonly name = Events.InteractionCreate;

	public constructor(private readonly commandHandler: CommandHandler) {}

	public async handle(interaction: Interaction) {
		switch (interaction.type) {
			case InteractionType.ApplicationCommandAutocomplete: {
				await this.commandHandler.handleAutocomplete(interaction);
				break;
			}

			case InteractionType.MessageComponent: {
				if (interaction.inCachedGuild()) {
					await this.commandHandler.handleMessageComponent(interaction);
				}

				logger.warn(interaction, 'Message component interaction in non-cached guild');
				break;
			}

			case InteractionType.ApplicationCommand: {
				await this.commandHandler.handleCommand(interaction);
				break;
			}

			default: {
				logger.warn(`Unknown interaction type: ${interaction.type}`);
			}
		}
	}
}
