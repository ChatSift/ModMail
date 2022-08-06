import { PrismaClient } from '@prisma/client';
import { ApplicationCommandType, Client, MessageContextMenuCommandInteraction } from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly containsSubcommands = false;
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		...getLocalizedProp('name', 'context-menus.expose.name'),
		type: ApplicationCommandType.Message,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: MessageContextMenuCommandInteraction<'cached'>) {
		const thread = await this.prisma.thread.findFirst({
			where: { channelId: interaction.channelId, closedById: null },
		});
		if (!thread) {
			return interaction.reply(i18next.t('common.errors.no_thread'));
		}

		const threadMessage = await this.prisma.threadMessage.findFirst({
			where: { thread, guildMessageId: interaction.targetMessage.id },
		});
		if (!threadMessage) {
			return interaction.reply(
				i18next.t('common.errors.resource_not_found', { resource: 'message', lng: interaction.locale }),
			);
		}

		const user = await this.client.users.fetch(thread.userId);
		const channel = await user.createDM();
		const message = await channel.messages.fetch(threadMessage.userMessageId).catch(() => null);
		const guildMessage = await interaction.channel!.messages.fetch(threadMessage.guildMessageId);

		if (!message) {
			return interaction.reply(i18next.t('common.errors.message_deleted', { lng: interaction.locale }));
		}

		return interaction.reply({ content: message.url, embeds: guildMessage.embeds });
	}
}
