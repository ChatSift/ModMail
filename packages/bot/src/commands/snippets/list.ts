import { PrismaClient, type Snippet } from '@prisma/client';
import type { ButtonBuilder } from 'discord.js';
import {
	type APIApplicationCommandSubcommandOption,
	type ChatInputCommandInteraction,
	ActionRowBuilder,
	Colors,
	EmbedBuilder,
	inlineCode,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type Subcommand } from '#struct/Command';
import { SelectMenuPaginator, type SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { ellipsis } from '#util/ellipsis';

@singleton()
export default class implements Subcommand {
	public readonly interactionOptions: Omit<APIApplicationCommandSubcommandOption, 'type'> = {
		...getLocalizedProp('name', 'commands.snippets.list.name'),
		...getLocalizedProp('description', 'commands.snippets.list.description'),
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const snippets = await this.prisma.snippet.findMany({ where: { guildId: interaction.guildId } });
		if (!snippets.length) {
			return interaction.reply({
				content: i18next.t('common.errors.no_resources', {
					resource: 'snippet',
					lng: interaction.locale,
				}),
			});
		}

		const paginator = new SelectMenuPaginator({
			key: 'snippet-list',
			data: snippets,
			maxPageLength: 40,
		});

		const embed = new EmbedBuilder()
			.setTitle(i18next.t('commands.snippets.list.embed.title', { lng: interaction.locale }))
			.setColor(Colors.Blurple);

		const actionRow = new ActionRowBuilder<ButtonBuilder>();

		const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Snippet[]>) => {
			const { data, pageLeftButton, pageRightButton } = consumers.asButtons();
			embed.setDescription(
				data
					.map(
						(snippet) =>
							`• ${inlineCode(snippet.name)}: ${inlineCode(ellipsis(snippet.content.replace('`', '\\`'), 100))}`,
					)
					.join('\n'),
			);
			actionRow.setComponents([pageLeftButton, pageRightButton]);
		};

		updateMessagePayload(paginator.getCurrentPage());

		const reply = await interaction.reply({
			embeds: [embed],
			components: [actionRow],
			fetchReply: true,
		});

		for await (const [component] of reply.createMessageComponentCollector({ idle: 30_000 })) {
			const isLeft = component.customId === 'page-left';
			updateMessagePayload(isLeft ? paginator.previousPage() : paginator.nextPage());
			await component.update({
				embeds: [embed],
				components: [actionRow],
			});
		}

		return reply.edit({ components: [] });
	}
}
