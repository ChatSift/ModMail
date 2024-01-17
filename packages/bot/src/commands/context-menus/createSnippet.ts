import type { MessageContextMenuCommandInteraction, PermissionResolvable } from 'discord.js';
import { ApplicationCommandType } from 'discord.js';
import { singleton } from 'tsyringe';
import promptSnippetAdd from '../../modals/snippets/add.js';
import type { Command, CommandBody } from '../../struct/Command.js';
import { getLocalizedProp } from '../../struct/Command.js';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		...getLocalizedProp('name', 'context_menus.create_snippet.name'),
		type: ApplicationCommandType.Message,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public requiredClientPermissions: PermissionResolvable = 'SendMessages';

	public async handle(interaction: MessageContextMenuCommandInteraction<'cached'>) {
		const targetMessageContent = interaction.targetMessage.content;

		return promptSnippetAdd(interaction, targetMessageContent);
	}
}
