import { PrismaClient, type Snippet, type SnippetUpdates } from '@prisma/client';
import type { APIEmbedField, PermissionResolvable } from 'discord.js';
import {
	type APIApplicationCommandSubcommandOption,
	ApplicationCommandOptionType,
	type ChatInputCommandInteraction,
	ActionRowBuilder,
	blockQuote,
	ButtonBuilder,
	ButtonStyle,
	codeBlock,
	Colors,
	EmbedBuilder,
	time,
	TimestampStyles,
	Client,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type Subcommand } from '#struct/Command';
import { SelectMenuPaginator, type SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { diff } from '#util/diff';
import { ellipsis } from '#util/ellipsis';

@singleton()
export default class implements Subcommand {
	public readonly interactionOptions: Omit<APIApplicationCommandSubcommandOption, 'type'> = {
		...getLocalizedProp('name', 'commands.snippets.show.name'),
		...getLocalizedProp('description', 'commands.snippets.show.description'),
		options: [
			{
				...getLocalizedProp('name', 'commands.snippets.show.options.name.name'),
				...getLocalizedProp('description', 'commands.snippets.show.options.name.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true,
			},
		],
	};

	public requiredClientPermissions: PermissionResolvable = ['SendMessages', 'EmbedLinks'];

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const name = interaction.options.getString('name', true);
		const snippet = await this.prisma.snippet.findFirst({
			where: {
				guildId: interaction.guildId,
				name,
			},
			include: { updates: { orderBy: { snippetUpdateId: 'asc' } } },
		});

		if (!snippet) {
			await interaction.reply({
				content: i18next.t('common.errors.resource_not_found', {
					resource: 'snippet',
					lng: interaction.locale,
				}),
			});
			return;
		}

		const getShowEmbed = async (embedSnippet: Snippet): Promise<EmbedBuilder> => {
			const fields: APIEmbedField[] = [];
			const createdBy = await this.client.users.fetch(embedSnippet.createdById).catch(() => null);

			fields.push({
				name: i18next.t('commands.snippets.show.embed.fields.created_by', { lng: interaction.locale }),
				value: createdBy?.toString() ?? `Unknown user: ${embedSnippet.createdById}`,
			});

			fields.push({
				name: i18next.t('commands.snippets.show.embed.fields.created_at', { lng: interaction.locale }),
				value: time(embedSnippet.createdAt, TimestampStyles.ShortDateTime),
				inline: true,
			});

			fields.push({
				name: i18next.t('commands.snippets.show.embed.fields.last_updated_at', { lng: interaction.locale }),
				value: time(embedSnippet.lastUpdatedAt, TimestampStyles.ShortDateTime),
				inline: true,
			});

			if (embedSnippet.lastUsedAt) {
				fields.push({
					name: i18next.t('commands.snippets.show.embed.fields.last_used_at', { lng: interaction.locale }),
					value: time(embedSnippet.lastUsedAt, TimestampStyles.ShortDateTime),
				});
			}

			return new EmbedBuilder()
				.setTitle(
					i18next.t('commands.snippets.show.embed.title', {
						name: embedSnippet.name,
						lng: interaction.locale,
					}),
				)
				.setDescription(blockQuote(ellipsis(embedSnippet.content, 4_000)))
				.setColor(Colors.Blurple)
				.addFields(fields)
				.setFooter({
					text: i18next.t('commands.snippets.show.embed.footer', {
						lng: interaction.locale,
						uses: embedSnippet.timesUsed,
					}),
				});
		};

		const reply = await interaction.reply({
			embeds: [await getShowEmbed(snippet)],
			components: snippet.updates.length
				? [
						new ActionRowBuilder<ButtonBuilder>().addComponents([
							new ButtonBuilder()
								.setStyle(ButtonStyle.Secondary)
								.setLabel(i18next.t('commands.snippets.show.buttons.view_history', { lng: interaction.locale }))
								.setCustomId('snippet-history'),
						]),
				  ]
				: undefined,
			fetchReply: true,
		});

		const component = await reply.awaitMessageComponent({ time: 30_000 }).catch(() => null);
		await reply.edit({ components: [] });

		if (component) {
			const { updates } = snippet;
			const paginator = new SelectMenuPaginator({
				key: 'snippet-history',
				data: updates,
				maxPageLength: 1,
			});

			const embed = new EmbedBuilder().setColor(Colors.Blurple);

			const actionRow = new ActionRowBuilder<ButtonBuilder>();
			const restoreButton = new ButtonBuilder()
				.setLabel(i18next.t('commands.snippets.show.buttons.restore', { lng: interaction.locale }))
				.setStyle(ButtonStyle.Danger);

			const updateMessagePayload = async (consumers: SelectMenuPaginatorConsumers<SnippetUpdates[]>) => {
				const { data, currentPage, pageLeftButton, pageRightButton } = consumers.asButtons();
				const [before] = data as [SnippetUpdates];
				// We go one update further to try to find the next content
				const updatedBy = await this.client.users.fetch(before.updatedBy).catch(() => null);
				const after = updates[currentPage + 1];
				embed
					.setTitle(`Update ${currentPage + 1}/${paginator.pageCount}`)
					.setDescription(codeBlock('diff', diff(before.oldContent, after?.oldContent ?? snippet.content)))
					.setFooter({
						text: i18next.t('commands.snippets.show.history.embed.footer', {
							lng: interaction.locale,
							user: updatedBy?.tag ?? 'Unknown User#0000',
						}),
						iconURL: updatedBy?.displayAvatarURL(),
					})
					.setTimestamp(before.updatedAt);
				restoreButton.setCustomId(`restore|${currentPage}`);
				actionRow.setComponents([pageLeftButton, restoreButton, pageRightButton]);
			};

			await updateMessagePayload(paginator.getCurrentPage());

			// eslint-disable-next-line no-shadow
			const reply = await component.reply({
				embeds: [embed],
				components: [actionRow],
				fetchReply: true,
			});

			for await (const [pageComponent] of reply.createMessageComponentCollector({ idle: 30_000 })) {
				const isRestore = pageComponent.customId.startsWith('restore');
				if (isRestore) {
					const [, idx] = pageComponent.customId.split('|') as [string, string];
					const update = updates[Number.parseInt(idx, 10)]!;
					const updatedSnippet = await this.prisma.snippet.update({
						where: {
							guildId_name: {
								guildId: interaction.guildId,
								name,
							},
						},
						data: { content: update.oldContent },
					});
					await this.prisma.snippetUpdates.create({
						data: {
							snippetId: snippet.snippetId,
							updatedBy: interaction.member.id,
							oldContent: snippet.content,
						},
					});

					await interaction.editReply({ embeds: [await getShowEmbed(updatedSnippet)] });
					await reply.delete();
					break;
				}

				const isLeft = pageComponent.customId === 'page-left';
				await updateMessagePayload(isLeft ? paginator.previousPage() : paginator.nextPage());
				await pageComponent.update({
					embeds: [embed],
					components: [actionRow],
				});
			}

			await reply.edit({ components: [] }).catch(() => null);
		}
	}
}
