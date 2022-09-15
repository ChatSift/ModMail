import { ms } from '@naval-base/ms';
import { PrismaClient } from '@prisma/client';
import type { ThreadChannel } from 'discord.js';
import { ApplicationCommandOptionType, ApplicationCommandType, type ChatInputCommandInteraction } from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { closeThread } from '#util/closeThread';
import { durationAutoComplete } from '#util/durationAutoComplete';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.close.name'),
		...getLocalizedProp('description', 'commands.close.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.close.options.time.name'),
				...getLocalizedProp('description', 'commands.close.options.time.description'),
				type: ApplicationCommandOptionType.String,
				autocomplete: true,
			},
			{
				...getLocalizedProp('name', 'commands.close.options.silent.name'),
				...getLocalizedProp('description', 'commands.close.options.silent.description'),
				type: ApplicationCommandOptionType.Boolean,
			},
			{
				...getLocalizedProp('name', 'commands.close.options.cancel.name'),
				...getLocalizedProp('description', 'commands.close.options.cancel.description'),
				type: ApplicationCommandOptionType.Boolean,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public handleAutocomplete = durationAutoComplete;

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const thread = await this.prisma.thread.findFirst({
			where: { channelId: interaction.channelId, closedById: null },
			include: {
				scheduledClose: true,
			},
		});
		if (!thread) {
			return interaction.reply(i18next.t('common.errors.no_thread'));
		}

		const cancel = interaction.options.getBoolean('cancel') ?? false;
		if (cancel) {
			if (!thread.scheduledClose) {
				return interaction.reply(i18next.t('commands.close.no_scheduled_close', { lng: interaction.locale }));
			}

			await this.prisma.scheduledThreadClose.delete({
				where: {
					threadId: thread.threadId,
				},
			});

			return interaction.reply(i18next.t('commands.close.successfully_canceled', { lng: interaction.locale }));
		}

		const rawTime = interaction.options.getString('time');
		let time: number | null = null;

		if (rawTime) {
			if (isNaN(Number(rawTime))) {
				try {
					time = ms(rawTime);
				} catch {
					return interaction.reply(i18next.t('common.errors.invalid_time', { lng: interaction.locale }));
				}
			} else {
				time = ms(`${rawTime}m`);
			}

			if (time <= 0) {
				return interaction.reply(i18next.t('common.errors.invalid_time', { lng: interaction.locale }));
			}
		}

		const silent = interaction.options.getBoolean('silent') ?? false;

		const reply = await interaction.reply({
			content: `Closing thread${time ? ` in ${ms(time, true)}` : ''}...`,
			fetchReply: true,
		});

		if (time) {
			const closeAt = new Date(Date.now() + time);
			await this.prisma.scheduledThreadClose.upsert({
				create: {
					threadId: thread.threadId,
					closeAt,
					scheduledById: interaction.user.id,
					silent,
				},
				update: {
					closeAt,
					silent,
				},
				where: { threadId: thread.threadId },
			});
		} else {
			await closeThread({ thread, channel: reply.channel as ThreadChannel, silent });

			await this.prisma.thread.update({
				data: {
					closedById: interaction.user.id,
					closedAt: new Date(),
				},
				where: {
					threadId: thread.threadId,
				},
			});

			await this.prisma.scheduledThreadClose.delete({ where: { threadId: thread.threadId } }).catch(() => null);
		}
	}
}
