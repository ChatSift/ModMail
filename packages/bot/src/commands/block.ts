import { ms } from '@naval-base/ms';
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
import { durationAutoComplete } from '#util/durationAutoComplete';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.block.name'),
		...getLocalizedProp('description', 'commands.block.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.block.options.duration.name'),
				...getLocalizedProp('description', 'commands.block.options.duration.description'),
				type: ApplicationCommandOptionType.String,
				autocomplete: true,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public handleAutocomplete = durationAutoComplete;

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const thread = await this.prisma.thread.findFirst({
			where: { channelId: interaction.channelId, closedById: null },
		});
		if (!thread) {
			return interaction.reply(i18next.t('common.errors.no_thread'));
		}

		const rawTime = interaction.options.getString('duration');
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

		const user = await this.client.users.fetch(thread.userId).catch(() => null);
		if (!user) {
			return interaction.reply(i18next.t('common.errors.user_deleted'));
		}

		const base = {
			guildId: interaction.guild.id,
			userId: user.id,
		};
		const expiresAt = time ? new Date(Date.now() + time) : undefined;

		await this.prisma.block.upsert({
			create: {
				...base,
				expiresAt,
			},
			update: {
				expiresAt,
			},
			where: {
				userId_guildId: base,
			},
		});

		return interaction.reply(i18next.t('common.success.blocked', { lng: interaction.locale }));
	}
}
