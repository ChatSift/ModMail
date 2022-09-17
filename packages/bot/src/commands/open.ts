import { ApplicationCommandOptionType, ApplicationCommandType, type ChatInputCommandInteraction } from 'discord.js';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { openThread } from '#util/handleThreadManagement';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.open.name'),
		...getLocalizedProp('description', 'commands.open.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.open.options.user.name'),
				...getLocalizedProp('description', 'commands.open.options.user.description'),
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	};

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		return openThread(interaction);
	}
}
