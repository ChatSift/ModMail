import type { MessageContextMenuCommandInteraction } from 'discord.js';
import { ApplicationCommandType } from 'discord.js';
import { singleton } from 'tsyringe';
import ReplyContextMenu from './reply';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		...getLocalizedProp('name', 'context-menus.reply-anon.name'),
		type: ApplicationCommandType.Message,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public constructor(private readonly replyContextMenu: ReplyContextMenu) {}

	public async handle(interaction: MessageContextMenuCommandInteraction<'cached'>) {
		return this.replyContextMenu.handle(interaction, true);
	}
}
