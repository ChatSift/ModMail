import type { APIApplicationCommandSubcommandOption, ChatInputCommandInteraction } from 'discord.js';
import { singleton } from 'tsyringe';
import promptSnippetAdd from '../../modals/snippets/add';
import { getLocalizedProp, type Subcommand } from '#struct/Command';

@singleton()
export default class implements Subcommand {
	public readonly interactionOptions: Omit<APIApplicationCommandSubcommandOption, 'type'> = {
		...getLocalizedProp('name', 'commands.snippets.add.name'),
		...getLocalizedProp('description', 'commands.snippets.add.description'),
		options: [],
	};

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		return promptSnippetAdd(interaction);
	}
}
