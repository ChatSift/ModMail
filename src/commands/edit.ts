import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	Client,
	ThreadChannel,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { sendStaffThreadMessage } from '#util/sendStaffThreadMessage';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.edit.name'),
		...getLocalizedProp('description', 'commands.edit.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.edit.options.id.name'),
				...getLocalizedProp('description', 'commands.edit.options.id.description'),
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
			{
				...getLocalizedProp('name', 'commands.edit.options.content.name'),
				...getLocalizedProp('description', 'commands.edit.options.content.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
			},
			{
				...getLocalizedProp('name', 'commands.edit.options.attachment.name'),
				...getLocalizedProp('description', 'commands.edit.options.attachment.description'),
				type: ApplicationCommandOptionType.Attachment,
			},
			{
				...getLocalizedProp('name', 'commands.edit.options.clear_attachment.name'),
				...getLocalizedProp('description', 'commands.edit.options.clear_attachment.description'),
				type: ApplicationCommandOptionType.Boolean,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const thread = await this.prisma.thread.findFirst({
			where: { channelId: interaction.channelId, closedById: null },
		});
		if (!thread) {
			return interaction.reply(i18next.t('common.errors.no_thread'));
		}

		const id = interaction.options.getInteger('id', true);
		const threadMessage = await this.prisma.threadMessage.findFirst({ where: { thread, localThreadMessageId: id } });
		if (!threadMessage) {
			return interaction.reply(
				i18next.t('common.errors.resource_not_found', { resource: 'message', lng: interaction.locale }),
			);
		}

		if (threadMessage.staffId !== interaction.user.id) {
			return interaction.reply(i18next.t('common.errors.not_own_message', { lng: interaction.locale }));
		}

		const content = interaction.options.getString('content', true);
		const attachment = interaction.options.getAttachment('attachment');
		const clearAttachment = interaction.options.getBoolean('clear-attachment');

		if (attachment && clearAttachment) {
			return interaction.reply(
				i18next.t('common.errors.arg_conflict', {
					first: 'attachment',
					second: 'clear-attachment',
					lng: interaction.locale,
				}),
			);
		}

		const member = await interaction.guild.members.fetch(thread.userId).catch(() => null);
		if (!member) {
			return interaction.reply(i18next.t('common.errors.no_member', { lng: interaction.locale }));
		}

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });
		const guildMessage = await (interaction.channel as ThreadChannel).messages.fetch(threadMessage.guildMessageId);
		const userChannel = await member.createDM();
		const userMessage = await userChannel.messages.fetch(threadMessage.userMessageId);

		await sendStaffThreadMessage({
			content: content,
			attachment: clearAttachment ? null : attachment,
			staff: interaction.member,
			member,
			channel: interaction.channel as ThreadChannel,
			threadId: thread.threadId,
			simpleMode: settings?.simpleMode ?? false,
			anon: threadMessage.anon,
			interaction,
			existing: { guild: guildMessage, user: userMessage, replyId: threadMessage.localThreadMessageId },
		});
	}
}
