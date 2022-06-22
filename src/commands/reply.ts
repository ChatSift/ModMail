import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	PermissionsBitField,
	ThreadChannel,
	type ApplicationCommandOptionChoiceData,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { sendThreadMessage } from '#util/sendThreadMessage';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.reply.name'),
		...getLocalizedProp('description', 'commands.reply.description'),
		type: ApplicationCommandType.ChatInput,
		dm_permission: false,
		default_member_permissions: new PermissionsBitField(PermissionsBitField.Flags.ManageGuild).toJSON(),
		options: [
			{
				...getLocalizedProp('name', 'commands.reply.options.content.name'),
				...getLocalizedProp('description', 'commands.reply.options.content.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true,
			},
			{
				...getLocalizedProp('name', 'commands.reply.options.attachment.name'),
				...getLocalizedProp('description', 'commands.reply.options.attachment.description'),
				type: ApplicationCommandOptionType.Attachment,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handleAutocomplete(
		interaction: AutocompleteInteraction<'cached'>,
	): Promise<ApplicationCommandOptionChoiceData[]> {
		const snippets = await this.prisma.snippet.findMany({
			where: { guildId: interaction.guild.id },
		});

		const input = interaction.options.getFocused();
		return snippets
			.filter((snippet) => snippet.name.includes(input) || snippet.content.includes(input))
			.map((snippet) => ({ name: snippet.content, value: snippet.content }))
			.slice(0, 5);
	}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const thread = await this.prisma.thread.findFirst({
			where: { channelId: interaction.channelId, closedById: null },
		});
		if (!thread) {
			return interaction.reply(i18next.t('commands.errors.no_thread'));
		}

		const attachment = interaction.options.getAttachment('attachment');

		const member = await interaction.guild.members.fetch(thread.recipientId).catch(() => null);
		if (!member) {
			return i18next.t('commands.errors.no_member', { lng: interaction.locale });
		}

		await sendThreadMessage({
			content: interaction.options.getString('content', true),
			attachment,
			member,
			channel: interaction.channel as ThreadChannel,
			staff: true,
			interaction,
		});
	}
}
