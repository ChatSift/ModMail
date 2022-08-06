import { PrismaClient, Snippet, SnippetUpdates } from '@prisma/client';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	blockQuote,
	ButtonBuilder,
	ButtonStyle,
	Client,
	codeBlock,
	Colors,
	EmbedBuilder,
	inlineCode,
	PermissionsBitField,
	time,
	TimestampStyles,
	type APIEmbedField,
	type ApplicationCommandOptionChoiceData,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { CommandHandler } from '#struct/CommandHandler';
import { SelectMenuPaginator, type SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { diff } from '#util/diff';
import { ellipsis } from '#util/ellipsis';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly containsSubcommands = false;
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.snippets.name'),
		...getLocalizedProp('description', 'commands.snippets.description'),
		type: ApplicationCommandType.ChatInput,
		dm_permission: false,
		default_member_permissions: new PermissionsBitField(PermissionsBitField.Flags.ManageGuild).toJSON(),
		options: [
			{
				...getLocalizedProp('name', 'commands.snippets.add.name'),
				...getLocalizedProp('description', 'commands.snippets.add.description'),
				type: ApplicationCommandOptionType.Subcommand,
				options: [
					{
						...getLocalizedProp('name', 'commands.snippets.add.options.name.name'),
						...getLocalizedProp('description', 'commands.snippets.add.options.name.description'),
						type: ApplicationCommandOptionType.String,
						required: true,
					},
					{
						...getLocalizedProp('name', 'commands.snippets.add.options.content.name'),
						...getLocalizedProp('description', 'commands.snippets.add.options.content.description'),
						type: ApplicationCommandOptionType.String,
						required: true,
					},
				],
			},
			{
				...getLocalizedProp('name', 'commands.snippets.remove.name'),
				...getLocalizedProp('description', 'commands.snippets.remove.description'),
				type: ApplicationCommandOptionType.Subcommand,
				options: [
					{
						...getLocalizedProp('name', 'commands.snippets.remove.options.name.name'),
						...getLocalizedProp('description', 'commands.snippets.remove.options.name.description'),
						type: ApplicationCommandOptionType.String,
						required: true,
						autocomplete: true,
					},
				],
			},
			{
				...getLocalizedProp('name', 'commands.snippets.edit.name'),
				...getLocalizedProp('description', 'commands.snippets.edit.description'),
				type: ApplicationCommandOptionType.Subcommand,
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
			},
			{
				...getLocalizedProp('name', 'commands.snippets.show.name'),
				...getLocalizedProp('description', 'commands.snippets.show.description'),
				type: ApplicationCommandOptionType.Subcommand,
				options: [
					{
						...getLocalizedProp('name', 'commands.snippets.show.options.name.name'),
						...getLocalizedProp('description', 'commands.snippets.show.options.name.description'),
						type: ApplicationCommandOptionType.String,
						required: true,
						autocomplete: true,
					},
				],
			},
			{
				...getLocalizedProp('name', 'commands.snippets.list.name'),
				...getLocalizedProp('description', 'commands.snippets.list.description'),
				type: ApplicationCommandOptionType.Subcommand,
			},
		],
	};

	public constructor(
		private readonly prisma: PrismaClient,
		private readonly client: Client,
		private readonly commandHandler: CommandHandler,
	) {}

	public async handleAutocomplete(
		interaction: AutocompleteInteraction<'cached'>,
	): Promise<ApplicationCommandOptionChoiceData[]> {
		const snippets = await this.prisma.snippet.findMany({
			where: { guildId: interaction.guild.id },
		});

		const input = interaction.options.getFocused();
		return snippets
			.filter((snippet) => snippet.name.includes(input) || snippet.content.includes(input))
			.map((snippet) => ({ name: snippet.name, value: snippet.name }))
			.slice(0, 5);
	}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const subcommand = interaction.options.getSubcommand(true);
		switch (subcommand) {
			case 'add': {
				const name = interaction.options.getString('name', true);
				const content = interaction.options.getString('content', true);

				if (this.commandHandler.commands.has(name)) {
					return interaction.reply({
						content: i18next.t('common.errors.reserved_name', { lng: interaction.locale }),
					});
				}

				const existing = await this.prisma.snippet.findFirst({ where: { guildId: interaction.guild.id, name } });
				if (existing) {
					return interaction.reply({
						content: i18next.t('common.errors.resource_exists', { resource: 'snippet', lng: interaction.locale }),
					});
				}

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

				const maxLen = 1900;
				if (content.length > maxLen) {
					return interaction.reply({
						content: i18next.t('common.errors.resource_too_long', {
							resource: 'snippet',
							length: maxLen,
							lng: interaction.locale,
						}),
					});
				}

				await interaction.deferReply();

				let command;
				try {
					command = await interaction.guild.commands.create({
						name,
						description: i18next.t('snippet_command.description'),
						default_member_permissions: '0',
						dm_permission: false,
						options: [
							{
								...getLocalizedProp('name', 'snippet_command.options.anon.name'),
								...getLocalizedProp('description', 'snippet_command.options.anon.description'),
								type: ApplicationCommandOptionType.Boolean,
							},
						],
					});
				} catch {
					return interaction.editReply({
						content: i18next.t('common.errors.bad_snippet_name', { lng: interaction.locale }),
					});
				}

				await this.prisma.snippet.create({
					data: {
						guildId: interaction.guildId,
						commandId: command.id,
						createdById: interaction.member.id,
						name,
						content,
					},
				});

				return interaction.editReply({
					content: i18next.t('common.success.resource_creation', { resource: 'snippet', lng: interaction.locale }),
				});
			}

			case 'remove': {
				const name = interaction.options.getString('name', true);
				const existing = await this.prisma.snippet.findFirst({ where: { guildId: interaction.guild.id, name } });
				if (!existing) {
					return interaction.reply({
						content: i18next.t('common.errors.resource_not_found', { resource: 'snippet', lng: interaction.locale }),
					});
				}

				await interaction.deferReply();

				await this.prisma.snippet.delete({ where: { guildId_name: { guildId: interaction.guildId, name } } });
				await interaction.guild.commands.delete(existing.commandId).catch(() => null);

				return interaction.editReply({
					content: i18next.t('common.success.resource_deletion', { resource: 'snippet', lng: interaction.locale }),
				});
			}

			case 'edit': {
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

			case 'show': {
				const name = interaction.options.getString('name', true);
				const snippet = await this.prisma.snippet.findFirst({
					where: { guildId: interaction.guildId, name },
					include: { updates: { orderBy: { snippetUpdateId: 'asc' } } },
				});

				if (!snippet) {
					return interaction.reply({
						content: i18next.t('common.errors.resource_not_found', { resource: 'snippet', lng: interaction.locale }),
					});
				}

				const getShowEmbed = async (snippet: Snippet): Promise<EmbedBuilder> => {
					const fields: APIEmbedField[] = [];
					const createdBy = await this.client.users.fetch(snippet.createdById).catch(() => null);

					fields.push({
						name: i18next.t('commands.snippets.show.embed.fields.created_by', { lng: interaction.locale }),
						value: createdBy?.toString() ?? `Unknown user: ${snippet.createdById}`,
					});

					fields.push({
						name: i18next.t('commands.snippets.show.embed.fields.created_at', { lng: interaction.locale }),
						value: time(snippet.createdAt, TimestampStyles.ShortDateTime),
						inline: true,
					});

					fields.push({
						name: i18next.t('commands.snippets.show.embed.fields.last_updated_at', { lng: interaction.locale }),
						value: time(snippet.lastUpdatedAt, TimestampStyles.ShortDateTime),
						inline: true,
					});

					if (snippet.lastUsedAt) {
						fields.push({
							name: i18next.t('commands.snippets.show.embed.fields.last_used_at', { lng: interaction.locale }),
							value: time(snippet.lastUsedAt, TimestampStyles.ShortDateTime),
						});
					}

					return new EmbedBuilder()
						.setTitle(i18next.t('commands.snippets.show.embed.title', { name: snippet.name, lng: interaction.locale }))
						.setDescription(blockQuote(ellipsis(snippet.content, 4000)))
						.setColor(Colors.Blurple)
						.addFields(fields)
						.setFooter({
							text: i18next.t('commands.snippets.show.embed.footer', {
								lng: interaction.locale,
								uses: snippet.timesUsed,
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

					const reply = await component.reply({
						embeds: [embed],
						components: [actionRow],
						fetchReply: true,
					});

					for await (const [pageComponent] of reply.createMessageComponentCollector({ idle: 30_000 })) {
						const isRestore = pageComponent.customId.startsWith('restore');
						if (isRestore) {
							const [, idx] = pageComponent.customId.split('|') as [string, string];
							const update = updates[parseInt(idx, 10)]!;
							const updatedSnippet = await this.prisma.snippet.update({
								where: { guildId_name: { guildId: interaction.guildId, name } },
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
						await pageComponent.update({ embeds: [embed], components: [actionRow] });
					}

					await reply.edit({ components: [] }).catch(() => null);
				}

				return;
			}

			case 'list': {
				const snippets = await this.prisma.snippet.findMany({ where: { guildId: interaction.guildId } });
				if (!snippets.length) {
					return interaction.reply({
						content: i18next.t('common.errors.no_resources', { resource: 'snippet', lng: interaction.locale }),
					});
				}

				const paginator = new SelectMenuPaginator({
					key: 'snippet-list',
					data: snippets,
					maxPageLength: 40,
				});

				const embed = new EmbedBuilder()
					.setTitle(
						i18next.t('commands.snippets.list.embed.title', {
							lng: interaction.locale,
						}),
					)
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
					await component.update({ embeds: [embed], components: [actionRow] });
				}

				return reply.edit({ components: [] });
			}

			default: {
				throw new Error(`Unknown subcommand ${subcommand}`);
			}
		}
	}
}
