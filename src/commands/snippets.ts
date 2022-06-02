import { PrismaClient, Prisma } from '@prisma/client';
import {
	ApplicationCommandOptionChoiceData,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	Colors,
	EmbedBuilder,
	inlineCode,
	PermissionsBitField,
} from 'discord.js';
import i18next from 'i18next';
import { PrismaError } from 'prisma-error-enum';
import { singleton } from 'tsyringe';
import { Command, CommandBody, getLocalizedProp } from '#struct/Command';
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
						autocomplete: true,
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

	public constructor(private readonly prisma: PrismaClient) {}

	public async handleAutocomplete(interaction: AutocompleteInteraction): Promise<ApplicationCommandOptionChoiceData[]> {
		const snippets = await this.prisma.snippet.findMany({
			where: { guildId: interaction.guild!.id },
		});

		return snippets.map((snippet) => ({
			name: snippet.name,
			value: snippet.content,
		}));
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

			case 'list': {
				const snippets = await this.prisma.snippet.findMany({ where: { guildId: interaction.guildId } });
				if (!snippets.length) {
					return interaction.reply({
						content: i18next.t('common.errors.no_resources', { resource: 'snippet', lng: interaction.locale }),
					});
				}

				const snippetText = snippets
					.map((snippet) => `• "${snippet.name}": ${ellipsis(inlineCode(snippet.content.replace('`', '`')), 50)}`)
					.join('\n');

				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setTitle(
								i18next.t('commands.snippets.subcommands.list.responses.success.embed.title', {
									lng: interaction.locale,
								}),
							)
							.setColor(Colors.Blurple)
							.setDescription(snippetText),
					],
				});
			}

			default: {
				throw new Error(`Unknown subcommand ${subcommand}`);
			}
		}
	}
}
