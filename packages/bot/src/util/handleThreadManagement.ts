import { PrismaClient } from '@prisma/client';
import type { ChatInputCommandInteraction, ThreadChannel } from 'discord.js';
import i18next from 'i18next';
import { container } from 'tsyringe';
import { sendStaffThreadMessage } from './sendStaffThreadMessage';

// TODO: Change this up later, currently is a copy-paste of edit command's handle function
export async function handleThreadManagement(interaction: ChatInputCommandInteraction<'cached'>) {
	const prisma = container.resolve(PrismaClient);

	const thread = await prisma.thread.findFirst({
		where: { channelId: interaction.channelId, closedById: null },
	});
	if (!thread) {
		return interaction.reply(i18next.t('common.errors.no_thread'));
	}

	const id = interaction.options.getInteger('id', true);
	const threadMessage = await prisma.threadMessage.findFirst({ where: { thread, localThreadMessageId: id } });
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

	const settings = await prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });
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
