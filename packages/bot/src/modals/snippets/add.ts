import { PrismaClient } from '@prisma/client';
import type { ModalSubmitInteraction, CommandInteraction } from 'discord.js';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';
import { getLocalizedProp } from '#struct/Command';
import { CommandHandler } from '#struct/CommandHandler';

const customId = 'snippet-modal';

async function handle(
	prisma: PrismaClient,
	commandHandler: CommandHandler,
	interaction: ModalSubmitInteraction<'cached'>,
) {
	const name = interaction.fields.getTextInputValue('titleInput');
	const content = interaction.fields.getTextInputValue('contentInput');

	// We should hope this is already checked before we reach this, but we shouldn't take any chances.
	const list = await prisma.snippet.findMany({ where: { guildId: interaction.guild.id } });
	if (list.length >= 50) {
		return interaction.reply({
			content: i18next.t('common.errors.resource_limit_reached', {
				resource: 'snippet',
				limit: 50,
				lng: interaction.locale,
			}),
		});
	}

	if (commandHandler.commands.has(name)) {
		return interaction.reply({ content: i18next.t('common.errors.reserved_name', { lng: interaction.locale }) });
	}

	const existing = await prisma.snippet.findFirst({
		where: {
			guildId: interaction.guild.id,
			name,
		},
	});
	if (existing) {
		return interaction.reply({
			content: i18next.t('common.errors.resource_exists', {
				resource: 'snippet',
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

	await prisma.snippet.create({
		data: {
			guildId: interaction.guildId,
			commandId: command.id,
			createdById: interaction.member.id,
			name,
			content,
		},
	});

	return interaction.editReply({
		content: i18next.t('common.success.resource_creation', {
			resource: 'snippet',
			lng: interaction.locale,
		}),
	});
}

function construct(content?: string): ModalBuilder {
	const addModal = new ModalBuilder().setCustomId(customId).setTitle('Add snippet');

	const snippetName = new TextInputBuilder()
		.setCustomId('titleInput')
		.setLabel('Title')
		.setPlaceholder('You cannot use spaces')
		.setStyle(TextInputStyle.Short);
	const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(snippetName);

	let snippetContent = new TextInputBuilder()
		.setCustomId('contentInput')
		.setLabel('Content')
		.setStyle(TextInputStyle.Paragraph)
		.setMaxLength(1_900);

	if (content !== undefined) {
		snippetContent = snippetContent.setValue(content);
	}

	const snippetRow = new ActionRowBuilder<TextInputBuilder>().addComponents(snippetContent);

	addModal.addComponents(nameRow, snippetRow);

	return addModal;
}

export default async function promptSnippetAdd(parentInteraction: CommandInteraction, content?: string) {
	const prisma = container.resolve(PrismaClient);
	const commandHandler = container.resolve(CommandHandler);

	const modal = construct(content);
	await parentInteraction.showModal(modal);

	const filter = (interaction: ModalSubmitInteraction) =>
		interaction.user.id === parentInteraction.user.id && interaction.customId === customId;

	try {
		const result = (await parentInteraction.awaitModalSubmit({
			filter,
			time: 60_000,
		})) as ModalSubmitInteraction<'cached'>;

		return await handle(prisma, commandHandler, result);
	} catch {
		return parentInteraction.reply({
			content: 'Response window expired.',
			ephemeral: true,
		});
	}
}
