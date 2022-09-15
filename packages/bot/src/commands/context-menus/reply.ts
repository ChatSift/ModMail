import { PrismaClient } from '@prisma/client';
import type { MessageContextMenuCommandInteraction, ThreadChannel } from 'discord.js';
import { ApplicationCommandType } from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { sendStaffThreadMessage } from '#util/sendStaffThreadMessage';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		...getLocalizedProp('name', 'context-menus.reply.name'),
		type: ApplicationCommandType.Message,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: MessageContextMenuCommandInteraction<'cached'>, anon = false) {
		const thread = await this.prisma.thread.findFirst({
			where: { channelId: interaction.channelId, closedById: null },
		});
		if (!thread) {
			return interaction.reply(i18next.t('common.errors.no_thread'));
		}

		if (interaction.targetMessage.author.id !== interaction.user.id) {
			return interaction.reply(i18next.t('common.errors.not_own_message'));
		}

		const member = await interaction.guild.members.fetch(thread.userId).catch(() => null);
		if (!member) {
			return i18next.t('common.errors.no_member', { lng: interaction.locale });
		}

		if (!interaction.targetMessage.content) {
			return interaction.reply(i18next.t('common.errors.no_content', { lng: interaction.locale }));
		}

		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });

		await sendStaffThreadMessage({
			content: interaction.targetMessage.content,
			attachment: interaction.targetMessage.attachments.first(),
			staff: interaction.member,
			member,
			channel: interaction.channel as ThreadChannel,
			threadId: thread.threadId,
			simpleMode: settings?.simpleMode ?? false,
			anon,
			interaction,
		});
	}
}
