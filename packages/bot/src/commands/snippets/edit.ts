import type { PrismaClient } from '@prisma/client';
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
		...getLocalizedProp('name', 'commands.snippets.edit.name'),
		...getLocalizedProp('description', 'commands.snippets.edit.description'),
		options: [
			{
				...getLocalizedProp('name', 'commands.snippets.edit.options.name.name'),
				...getLocalizedProp('description', 'commands.snippets.edit.options.name.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true,
			},
			{
				...getLocalizedProp('name', 'commands.snippets.edit.options.content.name'),
				...getLocalizedProp('description', 'commands.snippets.edit.options.content.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const name = interaction.options.getString('name', true);
		const content = interaction.options.getString('content', true);

		try {
			const snippet = await this.prisma.snippet.findFirst({
				where: { guildId: interaction.guildId, name },
				rejectOnNotFound: true,
			});
			await this.prisma.snippet.update({
				where: { guildId_name: { guildId: interaction.guildId, name } },
				data: { content },
			});

			await this.prisma.snippetUpdates.create({
				data: {
					snippetId: snippet.snippetId,
					updatedBy: interaction.member.id,
					oldContent: snippet.content,
				},
			});

			return await interaction.reply({
				content: i18next.t('common.success.resource_update', { resource: 'snippet', lng: interaction.locale }),
			});
		} catch (error) {
			if (error instanceof Error && error.name === 'NotFoundError') {
				return interaction.reply({
					content: i18next.t('common.errors.resource_not_found', { resource: 'snippet', lng: interaction.locale }),
				});
			}

			throw error;
		}
	}
}
