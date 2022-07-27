import {
	type ApplicationCommandOptionChoiceData,
	type ApplicationCommandType,
	type Attachment,
	type AutocompleteInteraction,
	type Awaitable,
	type Channel,
	type ChatInputCommandInteraction,
	type GuildMember,
	Locale,
	type MessageContextMenuCommandInteraction,
	type RESTPostAPIApplicationCommandsJSONBody,
	type Role,
	type User,
	type UserContextMenuCommandInteraction,
	ApplicationCommandOptionType,
	type CommandInteractionOptionResolver,
	type APIInteractionDataResolvedGuildMember,
	type APIRole,
	type APIInteractionDataResolvedChannel,
	APIApplicationCommandSubcommandOption,
} from 'discord.js';
import i18next from 'i18next';

interface InteractionTypeMapping {
	[ApplicationCommandType.ChatInput]: ChatInputCommandInteraction<'cached'>;
	[ApplicationCommandType.User]: UserContextMenuCommandInteraction<'cached'>;
	[ApplicationCommandType.Message]: MessageContextMenuCommandInteraction<'cached'>;
}

export type CommandBody<Type extends ApplicationCommandType> = RESTPostAPIApplicationCommandsJSONBody & {
	type: Type;
};

export interface Command<Type extends ApplicationCommandType = ApplicationCommandType> {
	readonly interactionOptions: CommandBody<Type>;
	handleAutocomplete?: (interaction: AutocompleteInteraction<any>) => Awaitable<ApplicationCommandOptionChoiceData[]>;
	handle: (interaction: InteractionTypeMapping[Type]) => Awaitable<unknown>;
}

export interface CommandWithSubcommands {
	readonly interactionOptions: Omit<CommandBody<ApplicationCommandType.ChatInput>, 'options'>;
	readonly subcommands: Map<string, Subcommand>;
	handleAutocomplete?: (interaction: AutocompleteInteraction) => Awaitable<ApplicationCommandOptionChoiceData[]>;
}

// As of right now, strict typings for the subcommand parameter requires extending SubcommandData
export interface Subcommand<T extends SubcommandData = SubcommandData>
	extends Omit<Command<ApplicationCommandType.ChatInput>, 'interactionOptions' | 'handle'> {
	readonly interactionOptions: Omit<
		APIApplicationCommandSubcommandOption & { options?: { isMember?: boolean }[] },
		'type'
	>;
	handle: (interaction: ChatInputCommandInteraction<'cached'>, subcommand?: T) => Awaitable<unknown>;
}

export type SubcommandData = Record<string, AllowedInteractionOptionTypes>;

export type AllowedInteractionOptionTypes =
	| string
	| number
	| boolean
	| User
	| Channel
	| Role
	| GuildMember
	| Attachment;

export type CommandConstructor = new (...args: any[]) => Command | CommandWithSubcommands;

export function interactionOptionTypeToReceivedOptionValue<
	T extends ApplicationCommandOptionType.Subcommand | ApplicationCommandOptionType.SubcommandGroup,
	Required extends boolean = false,
>(
	optionResolver: Omit<CommandInteractionOptionResolver, 'getMessage' | 'getFocused'>,
	{ type, required }: { type: T; required?: Required },
): Required extends true ? string : null | string;

export function interactionOptionTypeToReceivedOptionValue<
	T extends ApplicationCommandOptionType.User,
	Required extends boolean = false,
>(
	optionResolver: Omit<CommandInteractionOptionResolver, 'getMessage' | 'getFocused'>,
	{ type, name, required, isMember }: { type: T; name: string; required?: Required; isMember: true },
): Required extends true
	? GuildMember | APIInteractionDataResolvedGuildMember
	: null | APIInteractionDataResolvedGuildMember | GuildMember;

export function interactionOptionTypeToReceivedOptionValue<
	T extends Exclude<
		ApplicationCommandOptionType,
		| ApplicationCommandOptionType.User
		| ApplicationCommandOptionType.Subcommand
		| ApplicationCommandOptionType.SubcommandGroup
	>,
	Required extends boolean = false,
>(
	optionResolver: Omit<CommandInteractionOptionResolver, 'getMessage' | 'getFocused'>,
	{ type, name, required, isMember }: { type: T; name: string; required?: Required; isMember?: boolean },
): Required extends true
	? Exclude<AllowedInteractionOptionTypes, GuildMember>
	: null | Exclude<AllowedInteractionOptionTypes, GuildMember>;

export function interactionOptionTypeToReceivedOptionValue<T extends ApplicationCommandOptionType>(
	optionResolver: Omit<CommandInteractionOptionResolver, 'getMessage' | 'getFocused'>,
	{
		type,
		name,
		required = false,
		isMember = false,
	}: { type: T; name?: string; required?: boolean; isMember?: boolean },
):
	| null
	| AllowedInteractionOptionTypes
	| APIInteractionDataResolvedChannel
	| APIInteractionDataResolvedGuildMember
	| APIRole {
	switch (type) {
		case ApplicationCommandOptionType.String:
			return optionResolver.getString(name!, required);
		case ApplicationCommandOptionType.Number:
			return optionResolver.getNumber(name!, required);
		case ApplicationCommandOptionType.Integer:
			return optionResolver.getInteger(name!, required);
		case ApplicationCommandOptionType.Boolean:
			return optionResolver.getBoolean(name!, required);
		case ApplicationCommandOptionType.User:
			return isMember ? optionResolver.getMember(name!) : optionResolver.getUser(name!, required);
		case ApplicationCommandOptionType.Channel:
			return optionResolver.getChannel(name!, required);
		case ApplicationCommandOptionType.Role:
			return optionResolver.getRole(name!, required);
		case ApplicationCommandOptionType.Mentionable:
			return optionResolver.getMentionable(name!, required);
		case ApplicationCommandOptionType.Attachment:
			return optionResolver.getAttachment(name!, required);
		case ApplicationCommandOptionType.Subcommand:
			return optionResolver.getSubcommand(required);
		case ApplicationCommandOptionType.SubcommandGroup:
			return optionResolver.getSubcommandGroup(required);
		default:
			throw new Error(`Unknown option type: ${type}`);
	}
}

// PropAsIndexSignature and PropAsIndexSignatureLocalizations are separate because
// TS does not allow 2 index signatures
type PropAsIndexSignature<T extends string> = {
	[P in T]: string;
};
// This needs to be is own type, otherwise TS does not allow applying this within an index signature
type StringAsLocalizations<T extends string> = `${T}_localizations`;
type PropAsIndexSignatureLocalizations<T extends string> = {
	[P in StringAsLocalizations<T>]: Record<Locale, string>;
};

type LocalizedProp<T extends string> = PropAsIndexSignature<T> & PropAsIndexSignatureLocalizations<T>;

export function getLocalizedProp<Prop extends string>(prop: Prop, key: string) {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return {
		[prop]: i18next.t(key),
		[`${prop}_localizations`]: Object.fromEntries(
			Object.values(Locale).map((locale) => [locale, i18next.t(key, { lng: locale })]),
		),
	} as LocalizedProp<Prop>;
}
