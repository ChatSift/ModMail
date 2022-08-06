import { ApplicationCommandOptionType, ApplicationCommandType, type ChatInputCommandInteraction } from 'discord.js';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { handleStaffThreadMessage, HandleStaffThreadMessageAction } from '#util/handleStaffThreadMessage';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly containsSubcommands = false;
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.edit.name'),
		...getLocalizedProp('description', 'commands.edit.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.edit.options.id.name'),
				...getLocalizedProp('description', 'commands.edit.options.id.description'),
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				...getLocalizedProp('name', 'commands.edit.options.content.name'),
				...getLocalizedProp('description', 'commands.edit.options.content.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				...getLocalizedProp('name', 'commands.edit.options.attachment.name'),
				...getLocalizedProp('description', 'commands.edit.options.attachment.description'),
				type: ApplicationCommandOptionType.Attachment,
			},
			{
				...getLocalizedProp('name', 'commands.edit.options.clear_attachment.name'),
				...getLocalizedProp('description', 'commands.edit.options.clear_attachment.description'),
				type: ApplicationCommandOptionType.Boolean,
			},
		],
	};

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		return handleStaffThreadMessage(interaction, HandleStaffThreadMessageAction.Edit);
	}
}
