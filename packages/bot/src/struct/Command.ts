import type { PermissionResolvable } from 'discord.js';
import {
	type ApplicationCommandOptionChoiceData,
	type ApplicationCommandType,
	type AutocompleteInteraction,
	type Awaitable,
	type ChatInputCommandInteraction,
	Locale,
	type MessageContextMenuCommandInteraction,
	type RESTPostAPIApplicationCommandsJSONBody,
	type UserContextMenuCommandInteraction,
	type APIApplicationCommandSubcommandOption,
} from 'discord.js';
import i18next from 'i18next';
import type { TranslationKey } from '../util/i18nInit';

interface InteractionTypeMapping {
	[ApplicationCommandType.ChatInput]: ChatInputCommandInteraction<'cached'>;
	[ApplicationCommandType.User]: UserContextMenuCommandInteraction<'cached'>;
	[ApplicationCommandType.Message]: MessageContextMenuCommandInteraction<'cached'>;
}

export type CommandBody<Type extends ApplicationCommandType> = RESTPostAPIApplicationCommandsJSONBody & {
	type: Type;
};

export interface Command<Type extends ApplicationCommandType = ApplicationCommandType> {
	readonly containsSubcommands?: false;
	handle(interaction: InteractionTypeMapping[Type]): Awaitable<unknown>;
	handleAutocomplete?(interaction: AutocompleteInteraction<any>): Awaitable<ApplicationCommandOptionChoiceData[]>;
	readonly interactionOptions: CommandBody<Type>;
	readonly requiredClientPermissions?: PermissionResolvable;
}

export interface CommandWithSubcommands {
	readonly containsSubcommands: true;
	handleAutocomplete?(interaction: AutocompleteInteraction<any>): Awaitable<ApplicationCommandOptionChoiceData[]>;
	readonly interactionOptions: Omit<CommandBody<ApplicationCommandType.ChatInput>, 'options' | 'type'>;
	readonly requiredClientPermissions?: PermissionResolvable;
}

export type Subcommand = Omit<
	Command<ApplicationCommandType.ChatInput>,
	'containsSubcommands' | 'interactionOptions'
> & {
	readonly interactionOptions: Omit<APIApplicationCommandSubcommandOption, 'type'>;
};

export type CommandConstructor = new (...args: any[]) => Command | CommandWithSubcommands | Subcommand;

// PropAsIndexSignature and PropAsIndexSignatureLocalizations are separate because
// TS does not allow 2 index signatures
type PropAsIndexSignature<T extends string> = {
	[P in T]: string;
};
// This needs to be its own type, otherwise TS does not allow applying this within an index signature
type StringAsLocalizations<T extends string> = `${T}_localizations`;
type PropAsIndexSignatureLocalizations<T extends string> = {
	[P in StringAsLocalizations<T>]: Record<Locale, string>;
};

type LocalizedProp<T extends string> = PropAsIndexSignature<T> & PropAsIndexSignatureLocalizations<T>;

export function getLocalizedProp<Prop extends string>(prop: Prop, key: TranslationKey) {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return {
		[prop]: i18next.t(key),
		[`${prop}_localizations`]: Object.fromEntries(
			// @ts-expect-error - Type madness when using dynamic translation key types
			Object.values(Locale).map((locale) => [locale, i18next.t(key, { lng: locale })]),
		),
	} as LocalizedProp<Prop>;
}
