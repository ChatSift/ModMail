import { PrismaClient } from '@prisma/client';
import {
	type APIApplicationCommandSubcommandOption,
	ApplicationCommandOptionType,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type Subcommand } from '#struct/Command';

@singleton()
export default class implements Subcommand {
	public readonly interactionOptions: Omit<APIApplicationCommandSubcommandOption, 'type'> = {
		...getLocalizedProp('name', 'commands.snippets.remove.name'),
		...getLocalizedProp('description', 'commands.snippets.remove.description'),
		options: [
			{
				...getLocalizedProp('name', 'commands.snippets.remove.options.name.name'),
				...getLocalizedProp('description', 'commands.snippets.remove.options.name.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const name = interaction.options.getString('name', true);
		const existing = await this.prisma.snippet.findFirst({
			where: {
				guildId: interaction.guild.id,
				name,
			},
		});
		if (!existing) {
			return interaction.reply({
				content: i18next.t('common.errors.resource_not_found', {
					resource: 'snippet',
					lng: interaction.locale,
				}),
			});
		}

		await interaction.deferReply();

		await this.prisma.snippet.delete({
			where: {
				guildId_name: {
					guildId: interaction.guildId,
					name,
				},
			},
		});
		await interaction.guild.commands.delete(existing.commandId).catch(() => null);

		return interaction.editReply({
			content: i18next.t('common.success.resource_deletion', {
				resource: 'snippet',
				lng: interaction.locale,
			}),
		});
	}
}
