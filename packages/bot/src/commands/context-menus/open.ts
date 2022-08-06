import { ApplicationCommandType, type UserContextMenuCommandInteraction } from 'discord.js';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { openThread } from '#util/handleThreadManagement';

@singleton()
export default class implements Command<ApplicationCommandType.User> {
	public readonly containsSubcommands = false;
	public readonly interactionOptions: CommandBody<ApplicationCommandType.User> = {
		...getLocalizedProp('name', 'context-menus.open.name'),
		type: ApplicationCommandType.User,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public handle(interaction: UserContextMenuCommandInteraction<'cached'>) {
		return openThread(interaction);
	}
}
