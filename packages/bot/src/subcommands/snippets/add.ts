import {
	ApplicationCommandOptionType,
	type ApplicationCommandSubCommand,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { singleton } from 'tsyringe';
import { type AllowedInteractionOptionTypes, getLocalizedProp, type Subcommand } from '#struct/Command';

// refer to explanation in struct/Command.ts above Subcommand interface declaration
interface SnippetAddOptions extends Record<string, AllowedInteractionOptionTypes> {
	readonly name: string;
	readonly content: number;
}

@singleton()
export default class implements Subcommand<SnippetAddOptions> {
	public readonly interactionOptions: Omit<ApplicationCommandSubCommand, 'type'> = {
		...getLocalizedProp('name', 'commands.snippets.add.name'),
		...getLocalizedProp('description', 'commands.snippets.add.description'),
		options: [
			{
				...getLocalizedProp('name', 'commands.snippets.add.options.name.name'),
				...getLocalizedProp('description', 'commands.snippets.add.options.name.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				...getLocalizedProp('name', 'commands.snippets.add.options.content.name'),
				...getLocalizedProp('description', 'commands.snippets.add.options.content.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	};

	public handle(interaction: ChatInputCommandInteraction<'cached'>, subcommand: SnippetAddOptions) {
		subcommand.content;
		subcommand.name;
		return interaction.reply({ content: 'unimplemented', ephemeral: true });
	}
}
