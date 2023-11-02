import type { GuildSettings } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { stripIndents } from 'common-tags';
import type { PermissionResolvable, TextChannel } from 'discord.js';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ChannelType,
	Client,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.config.name'),
		...getLocalizedProp('description', 'commands.config.description'),
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.config.options.modmail_channel.name'),
				...getLocalizedProp('description', 'commands.config.options.modmail_channel.description'),
				type: ApplicationCommandOptionType.Channel,
				channel_types: [ChannelType.GuildText, ChannelType.GuildForum],
			},
			{
				...getLocalizedProp('name', 'commands.config.options.greeting.name'),
				...getLocalizedProp('description', 'commands.config.options.greeting.description'),
				type: ApplicationCommandOptionType.String,
			},
			{
				...getLocalizedProp('name', 'commands.config.options.farewell.name'),
				...getLocalizedProp('description', 'commands.config.options.farewell.description'),
				type: ApplicationCommandOptionType.String,
			},
			{
				...getLocalizedProp('name', 'commands.config.options.simple_mode.name'),
				...getLocalizedProp('description', 'commands.config.options.simple_mode.description'),
				type: ApplicationCommandOptionType.Boolean,
			},
			{
				...getLocalizedProp('name', 'commands.config.options.alert_role.name'),
				...getLocalizedProp('description', 'commands.config.options.alert_role.description'),
				type: ApplicationCommandOptionType.Role,
			},
		],
	};

	public requiredClientPermissions: PermissionResolvable = 'SendMessages';

	public constructor(
		private readonly prisma: PrismaClient,
		private readonly client: Client,
	) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const { guildId, ...settings } =
			(await this.prisma.guildSettings.findFirst({
				where: { guildId: interaction.guild.id },
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			})) ?? ({} as Partial<Omit<GuildSettings, 'guild_id'>>);

		const channel = interaction.options.getChannel('modmail-channel') as TextChannel | null;
		const greeting = interaction.options.getString('greeting');
		const farewell = interaction.options.getString('farewell');
		const simple = interaction.options.getBoolean('simple-mode');
		const alertRole = interaction.options.getRole('alert-role');

		if (channel) {
			settings.modmailChannelId = channel.id;
		}

		if (greeting) {
			settings.greetingMessage = greeting;
		}

		if (farewell) {
			settings.farewellMessage = farewell;
		}

		if (simple !== null) {
			settings.simpleMode = simple;
		}

		if (alertRole) {
			settings.alertRoleId = alertRole.id;
		}

		const configured = await this.prisma.guildSettings.upsert({
			create: {
				guildId: interaction.guild.id,
				...settings,
			},
			update: settings,
			where: { guildId: interaction.guild.id },
		});

		return interaction.reply({
			content: stripIndents`
				• **modmail channel**: ${configured.modmailChannelId ? `<#${configured.modmailChannelId}>` : 'none'}
				• **greeting message**: ${configured.greetingMessage ? configured.greetingMessage : 'none'}
				• **farewell message**: ${configured.farewellMessage ? configured.farewellMessage : 'none'}
				• **simple mode**: ${configured.simpleMode ? 'enabled' : 'disabled'}
				• **alert role**: ${configured.alertRoleId ? `<@&${configured.alertRoleId}>` : 'none'}
			`,
			allowedMentions: { parse: [] },
		});
	}
}
