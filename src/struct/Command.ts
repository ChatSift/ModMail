import {
	ApplicationCommandOptionChoiceData,
	ApplicationCommandType,
	AutocompleteInteraction,
	Awaitable,
	ChatInputCommandInteraction,
	MessageContextMenuCommandInteraction,
	RESTPostAPIApplicationCommandsJSONBody,
	UserContextMenuCommandInteraction,
} from 'discord.js';

interface InteractionTypeMapping {
	[ApplicationCommandType.ChatInput]: ChatInputCommandInteraction;
	[ApplicationCommandType.User]: UserContextMenuCommandInteraction;
	[ApplicationCommandType.Message]: MessageContextMenuCommandInteraction;
}

export type CommandBody<Type extends ApplicationCommandType> = RESTPostAPIApplicationCommandsJSONBody & {
	type: Type;
};

export interface Command<Type extends ApplicationCommandType = ApplicationCommandType> {
	readonly interactionOptions: CommandBody<Type>;
	handleAutocomplete?: (interaction: AutocompleteInteraction) => Awaitable<ApplicationCommandOptionChoiceData[]>;
	handle: (interaction: InteractionTypeMapping[Type]) => unknown;
}

export type CommandConstructor = new (...args: any[]) => Command;
