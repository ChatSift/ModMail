import { Prisma, PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	Client,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { PrismaError } from 'prisma-error-enum';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.unblock.name'),
		...getLocalizedProp('description', 'commands.unblock.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.unblock.options.user.name'),
				...getLocalizedProp('description', 'commands.unblock.options.user.description'),
				type: ApplicationCommandOptionType.User,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const user = interaction.options.getUser('user', true);

		try {
			await this.prisma.block.delete({
				where: {
					userId_guildId: {
						guildId: interaction.guild.id,
						userId: user.id,
					},
				},
			});
			return await interaction.reply({
				content: i18next.t('common.success.unblocked', { lng: interaction.locale }),
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PrismaError.RecordsNotFound) {
				return interaction.reply({
					content: i18next.t('common.errors.not_blocked', { lng: interaction.locale }),
				});
			}

			throw error;
		}
	}
}
