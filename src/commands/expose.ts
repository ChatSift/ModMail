import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	Client,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.expose.name'),
		...getLocalizedProp('description', 'commands.expose.description'),
		type: ApplicationCommandType.ChatInput,
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.expose.options.id.name'),
				...getLocalizedProp('description', 'commands.expose.options.id.description'),
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
		const threadMessage = await this.prisma.threadMessage.findFirst({ where: { thread, threadMessageId: id } });
		if (!threadMessage) {
			return interaction.reply(
				i18next.t('common.errors.resource_not_found', { resource: 'message', lng: interaction.locale }),
			);
		}

		const user = await this.client.users.fetch(thread.userId);
		const channel = await user.createDM();
		const message = await channel.messages.fetch(threadMessage.userMessageId).catch(() => null);

		if (!message) {
			return interaction.reply(i18next.t('common.errors.message_deleted', { lng: interaction.locale }));
		}

		return interaction.reply(message.url);
	}
}
