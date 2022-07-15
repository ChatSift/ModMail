import type { PrismaClient } from '@prisma/client';
import { ApplicationCommandType, type Client, type UserContextMenuCommandInteraction } from 'discord.js';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { handleThreadManagement } from '#util/handleThreadManagement';

@singleton()
export default class implements Command<ApplicationCommandType.User> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.User> = {
		...getLocalizedProp('name', 'context-menus.open.name'),
		type: ApplicationCommandType.User,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: UserContextMenuCommandInteraction<'cached'>) {
		return handleThreadManagement(interaction);
	}
}
