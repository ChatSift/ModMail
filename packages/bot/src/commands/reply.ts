import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ThreadChannel,
	type ApplicationCommandOptionChoiceData,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { sendStaffThreadMessage } from '#util/sendStaffThreadMessage';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.reply.name'),
		...getLocalizedProp('description', 'commands.reply.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.reply.options.content.name'),
				...getLocalizedProp('description', 'commands.reply.options.content.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				...getLocalizedProp('name', 'commands.reply.options.attachment.name'),
				...getLocalizedProp('description', 'commands.reply.options.attachment.description'),
				type: ApplicationCommandOptionType.Attachment,
			},
			{
				...getLocalizedProp('name', 'commands.reply.options.anon.name'),
				...getLocalizedProp('description', 'commands.reply.options.anon.description'),
				type: ApplicationCommandOptionType.Boolean,
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
			return interaction.reply(i18next.t('common.errors.no_thread'));
		}

		const content = interaction.options.getString('content', true);
		const attachment = interaction.options.getAttachment('attachment');
		const anon = interaction.options.getBoolean('anon');

		const member = await interaction.guild.members.fetch(thread.userId).catch(() => null);
		if (!member) {
			return i18next.t('common.errors.no_member', { lng: interaction.locale });
		}

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });

		await sendStaffThreadMessage({
			content,
			attachment,
			staff: interaction.member,
			member,
			channel: interaction.channel as ThreadChannel,
			threadId: thread.threadId,
			simpleMode: settings?.simpleMode ?? false,
			anon: anon ?? false,
			interaction,
		});
	}
}