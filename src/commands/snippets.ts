import { PrismaClient, Prisma, Snippet } from '@prisma/client';
import {
	ActionRowBuilder,
	type APIEmbedField,
	type ApplicationCommandOptionChoiceData,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type AutocompleteInteraction,
	blockQuote,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	Client,
	Colors,
	EmbedBuilder,
	inlineCode,
	PermissionsBitField,
	time,
	TimestampStyles,
} from 'discord.js';
import i18next from 'i18next';
import { PrismaError } from 'prisma-error-enum';
import { singleton } from 'tsyringe';
import { Command, CommandBody, getLocalizedProp } from '#struct/Command';
import { SelectMenuPaginator, SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';
import { ellipsis } from '#util/ellipsis';

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

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handleAutocomplete(
		interaction: AutocompleteInteraction<'cached'>,
	): Promise<ApplicationCommandOptionChoiceData[]> {
		const snippets = await this.prisma.snippet.findMany({
			where: { guildId: interaction.guild.id },
		});

		return snippets.map((snippet) => ({ name: snippet.name, value: snippet.name }));
	}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const subcommand = interaction.options.getSubcommand(true);
		switch (subcommand) {
			case 'add': {
				const name = interaction.options.getString('name', true);
				const content = interaction.options.getString('content', true);

				try {
					await this.prisma.snippet.create({
						data: {
							guildId: interaction.guildId,
							createdById: interaction.member.id,
							name,
							content,
						},
					});

					return await interaction.reply({
						content: i18next.t('common.success.resource_creation', { resource: 'snippet', lng: interaction.locale }),
					});
				} catch (error) {
					if (
						error instanceof Prisma.PrismaClientKnownRequestError &&
						error.code === PrismaError.UniqueConstraintViolation
					) {
						return interaction.reply({
							content: i18next.t('common.errors.resource_exists', { resource: 'snippet', lng: interaction.locale }),
						});
					}

					throw error;
				}
			}

			case 'remove': {
				const name = interaction.options.getString('name', true);

				try {
					await this.prisma.snippet.delete({ where: { guildId_name: { guildId: interaction.guildId, name } } });
					return await interaction.reply({
						content: i18next.t('common.success.resource_deletion', { resource: 'snippet', lng: interaction.locale }),
					});
				} catch (error) {
					if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PrismaError.RecordsNotFound) {
						return interaction.reply({
							content: i18next.t('common.errors.resource_not_found', { resource: 'snippet', lng: interaction.locale }),
						});
					}

					throw error;
				}
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
				});

				if (!snippet) {
					return interaction.reply({
						content: i18next.t('common.errors.resource_not_found', { resource: 'snippet', lng: interaction.locale }),
					});
				}

				const fields: APIEmbedField[] = [];
				const createdBy = await this.client.users.fetch(snippet.createdById).catch(() => null);

				fields.push({
					name: i18next.t('commands.snippets.show.embed.fields.created_by', { lng: interaction.locale }),
					value: createdBy?.tag ?? `Unknown user: ${snippet.createdById}`,
				});

				fields.push({
					name: i18next.t('commands.snippets.show.embed.fields.created_at', { lng: interaction.locale }),
					value: time(snippet.createdAt, TimestampStyles.LongDateTime),
				});

				fields.push({
					name: i18next.t('commands.snippets.show.embed.fields.last_updated_at', { lng: interaction.locale }),
					value: time(snippet.lastUpdatedAt, TimestampStyles.LongDateTime),
				});

				fields.push({
					name: i18next.t('commands.snippets.show.embed.fields.uses', { lng: interaction.locale }),
					value: snippet.timesUsed.toString(),
				});

				if (snippet.lastUsedAt) {
					fields.push({
						name: i18next.t('commands.snippets.show.embed.fields.last_used_at', { lng: interaction.locale }),
						value: time(snippet.lastUsedAt, TimestampStyles.LongDateTime),
					});
				}

				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle(
								i18next.t('commands.snippets.show.embed.title', { name: snippet.name, lng: interaction.locale }),
							)
							.setDescription(blockQuote(ellipsis(snippet.content, 4000)))
							.setColor(Colors.Blurple)
							.addFields(fields),
					],
					components: [
						new ActionRowBuilder<ButtonBuilder>().addComponents([
							new ButtonBuilder()
								.setStyle(ButtonStyle.Secondary)
								.setLabel(i18next.t('commands.snippets.show.buttons.view_history', { lng: interaction.locale }))
								.setCustomId(`snippet-history|${snippet.snippetId}`),
						]),
					],
				});
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

				const updateMessage = (consumers: SelectMenuPaginatorConsumers<Snippet[]>) => {
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

				updateMessage(paginator.getCurrentPage());

				const reply = await interaction.reply({
					embeds: [embed],
					components: [actionRow],
					fetchReply: true,
				});

				for await (const [component] of reply.createMessageComponentCollector({ idle: 30_000 })) {
					const isLeft = component.customId === 'page-left';
					updateMessage(isLeft ? paginator.previousPage() : paginator.nextPage());
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
