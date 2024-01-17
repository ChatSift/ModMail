import type { MessageContextMenuCommandInteraction, PermissionResolvable } from 'discord.js';
import { ApplicationCommandType } from 'discord.js';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '../../struct/Command.js';
import ReplyContextMenu from './reply.js';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		...getLocalizedProp('name', 'context_menus.reply_anon.name'),
		type: ApplicationCommandType.Message,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public requiredClientPermissions: PermissionResolvable = ['SendMessagesInThreads', 'EmbedLinks'];

	public constructor(private readonly replyContextMenu: ReplyContextMenu) {}

	public async handle(interaction: MessageContextMenuCommandInteraction<'cached'>) {
		return this.replyContextMenu.handle(interaction, true);
	}
}
