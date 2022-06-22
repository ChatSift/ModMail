import { ms } from '@naval-base/ms';
import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	Client,
	PermissionsBitField,
	ThreadChannel,
	type ApplicationCommandOptionChoiceData,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { closeThread } from '../util/closeThread';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.close.name'),
		...getLocalizedProp('description', 'commands.close.description'),
		type: ApplicationCommandType.ChatInput,
		dm_permission: false,
		default_member_permissions: new PermissionsBitField(PermissionsBitField.Flags.ManageGuild).toJSON(),
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
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client<true>) {}

	public handleAutocomplete(interaction: AutocompleteInteraction<'cached'>): ApplicationCommandOptionChoiceData[] {
		const commonOptions = ['1min', '5min', '30min', '1h', '1d', '7d'].map((time) => {
			const parsed = ms(ms(time), true);
			return {
				name: parsed,
				value: parsed,
			};
		});

		const input = interaction.options.getFocused();
		const raw = commonOptions.filter((option) => option.name.includes(input));

		let parsedMs: number;
		if (isNaN(Number(input))) {
			try {
				parsedMs = ms(input);
			} catch {
				return raw;
			}
		} else {
			// Treat the number as minutes
			parsedMs = ms(`${input}m`);
		}

		if (parsedMs <= 0) {
			return raw;
		}

		const parsed = ms(parsedMs, true);
		return commonOptions.filter((option) => option.name.includes(parsed));
	}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const thread = await this.prisma.thread.findFirst({ where: { channelId: interaction.channelId } });
		if (!thread) {
			return interaction.reply(i18next.t('commands.errors.no_thread'));
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
				},
				update: {
					closeAt,
				},
				where: { threadId: thread.threadId },
			});
		} else {
			await closeThread({ thread, channel: reply.channel as ThreadChannel, silent });

			await this.prisma.thread.update({
				data: {
					closedById: interaction.user.id,
					closedAt: new Date(),
					scheduledClose: {
						delete: true,
					},
				},
				where: {
					threadId: thread.threadId,
				},
			});
		}
	}
}
