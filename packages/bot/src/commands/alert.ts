import { PrismaClient } from '@prisma/client';
import { ApplicationCommandType, type ChatInputCommandInteraction } from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { durationAutoComplete } from '#util/durationAutoComplete';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.alert.name'),
		...getLocalizedProp('description', 'commands.alert.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public handleAutocomplete = durationAutoComplete;

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const thread = await this.prisma.thread.findFirst({
			where: {
				channelId: interaction.channelId,
				closedById: null,
			},
		});
		// Local alerts
		if (thread) {
			// eslint-disable-next-line no-shadow
			const params = {
				threadId: thread.threadId,
				userId: interaction.user.id,
			};
			// eslint-disable-next-line no-shadow
			const existingAlert = await this.prisma.threadReplyAlert.findFirst({ where: params });

			if (existingAlert) {
				await this.prisma.threadReplyAlert.delete({ where: { threadId_userId: params } });
				return interaction.reply(i18next.t('common.success.no_alert_thread', { lng: interaction.locale }));
			}

			await this.prisma.threadReplyAlert.create({ data: params });
			return interaction.reply(i18next.t('common.success.alert_thread', { lng: interaction.locale }));
		}

		// Global alerts
		const settings = await this.prisma.guildSettings.findFirst({ where: { guildId: interaction.guild.id } });
		if (settings?.alertRoleId) {
			const role = interaction.guild.roles.cache.get(settings.alertRoleId);
			if (role) {
				if (interaction.member.roles.cache.has(role.id)) {
					await interaction.member.roles.remove(role);
					return interaction.reply(i18next.t('common.success.no_alert_global', { lng: interaction.locale }));
				}

				await interaction.member.roles.add(role);
				return interaction.reply(i18next.t('common.success.alert_global', { lng: interaction.locale }));
			}
		}

		const params = {
			guildId: interaction.guild.id,
			userId: interaction.user.id,
		};
		const existingAlert = await this.prisma.threadOpenAlert.findFirst({ where: params });

		if (existingAlert) {
			await this.prisma.threadOpenAlert.delete({ where: { guildId_userId: params } });
			return interaction.reply(i18next.t('common.success.no_alert_global', { lng: interaction.locale }));
		}

		await this.prisma.threadOpenAlert.create({ data: params });
		return interaction.reply(i18next.t('common.success.alert_global', { lng: interaction.locale }));
	}
}
