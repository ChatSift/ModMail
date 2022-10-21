import { PrismaClient } from '@prisma/client';
import type { APIApplicationCommandSubcommandOption, ChatInputCommandInteraction } from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import promptSnippetAdd from '../../modals/snippets/add';
import { getLocalizedProp, type Subcommand } from '#struct/Command';

@singleton()
export default class implements Subcommand {
	public readonly interactionOptions: Omit<APIApplicationCommandSubcommandOption, 'type'> = {
		...getLocalizedProp('name', 'commands.snippets.add.name'),
		...getLocalizedProp('description', 'commands.snippets.add.description'),
		options: [],
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const list = await this.prisma.snippet.findMany({ where: { guildId: interaction.guild.id } });
		if (list.length >= 50) {
			return interaction.reply({
				content: i18next.t('common.errors.resource_limit_reached', {
					resource: 'snippet',
					limit: 50,
					lng: interaction.locale,
				}),
			});
		}

		return promptSnippetAdd(interaction);
	}
}
