import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ChatInputCommandInteraction,
	PermissionsBitField,
} from 'discord.js';
import { singleton } from 'tsyringe';
import { Command, CommandBody, getLocalizedProp } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.snippets.name'),
		...getLocalizedProp('description', 'commands.snippets.description'),
		type: ApplicationCommandType.ChatInput,
		dm_permission: false,
		default_member_permissions: new PermissionsBitField(PermissionsBitField.Flags.ManageGuild).toJSON(),
		options: [
			{
				...getLocalizedProp('name', 'commands.snippets.subcommands.add.name'),
				...getLocalizedProp('description', 'commands.snippets.subcommands.add.description'),
				type: ApplicationCommandOptionType.Subcommand,
				options: [
					{
						...getLocalizedProp('name', 'commands.snippets.subcommands.add.options.name.name'),
						...getLocalizedProp('description', 'commands.snippets.subcommands.add.options.name.description'),
						type: ApplicationCommandOptionType.String,
						required: true,
					},
					{
						...getLocalizedProp('name', 'commands.snippets.subcommands.add.options.content.name'),
						...getLocalizedProp('description', 'commands.snippets.subcommands.add.options.content.description'),
						type: ApplicationCommandOptionType.String,
						required: true,
					},
				],
			},
			{
				...getLocalizedProp('name', 'commands.snippets.subcommands.remove.name'),
				...getLocalizedProp('description', 'commands.snippets.subcommands.remove.description'),
				type: ApplicationCommandOptionType.Subcommand,
				options: [
					{
						...getLocalizedProp('name', 'commands.snippets.subcommands.remove.options.name.name'),
						...getLocalizedProp('description', 'commands.snippets.subcommands.remove.options.name.description'),
						type: ApplicationCommandOptionType.String,
						required: true,
					},
				],
			},
			{
				...getLocalizedProp('name', 'commands.snippets.subcommands.list.name'),
				...getLocalizedProp('description', 'commands.snippets.subcommands.list.description'),
				type: ApplicationCommandOptionType.Subcommand,
			},
		],
	};

	public handle(interaction: ChatInputCommandInteraction) {
		return interaction;
	}
}
