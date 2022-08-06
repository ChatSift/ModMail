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

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.delete.name'),
		...getLocalizedProp('description', 'commands.delete.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.delete.options.id.name'),
				...getLocalizedProp('description', 'commands.delete.options.id.description'),
				type: ApplicationCommandOptionType.Integer,
				required: true,
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

		const member = await interaction.guild.members.fetch(thread.userId).catch(() => null);
		if (!member) {
			return interaction.reply(i18next.t('common.errors.no_member', { lng: interaction.locale }));
		}

		const userChannel = await member.createDM();
		const userMessage = await userChannel.messages.fetch(threadMessage.userMessageId);
		await userMessage.delete().catch(() => null);

		const guildMessage = await (interaction.channel as ThreadChannel).messages.fetch(threadMessage.guildMessageId);
		await guildMessage.delete().catch(() => null);

		return interaction.reply(i18next.t('common.success.reply_deleted', { lng: interaction.locale }));
	}
}
