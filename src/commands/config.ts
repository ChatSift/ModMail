import { GuildSettings, PrismaClient } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ChannelType,
	Client,
	PermissionsBitField,
	TextChannel,
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
		default_member_permissions: new PermissionsBitField(PermissionsBitField.Flags.ManageGuild).toJSON(),
		dm_permission: false,
		options: [
			{
				...getLocalizedProp('name', 'commands.config.options.modmail_channel.name'),
				...getLocalizedProp('description', 'commands.config.options.modmail_channel.description'),
				type: ApplicationCommandOptionType.Channel,
				channel_types: [ChannelType.GuildText],
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
		],
	};

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const { guildId, ...settings } =
			(await this.prisma.guildSettings.findFirst({
				where: { guildId: interaction.guild.id },
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			})) ?? ({} as Partial<Omit<GuildSettings, 'guild_id'>>);

		const channel = interaction.options.getChannel('modmail-channel') as TextChannel | null;
		const greeting = interaction.options.getString('greeting');
		const farewell = interaction.options.getString('farewell');

		if (channel) {
			settings.modmailChannelId = channel.id;
		}

		if (greeting) {
			settings.greetingMessage = greeting;
		}

		if (farewell) {
			settings.farewellMessage = farewell;
		}

		const configured = await this.prisma.guildSettings.upsert({
			create: { guildId: interaction.guild.id, ...settings },
			update: settings,
			where: { guildId: interaction.guild.id },
		});

		return interaction.reply(stripIndents`
			• **modmail channel**: ${configured.modmailChannelId ? `<#${configured.modmailChannelId}>` : 'none'}
			• **greeting message**: ${configured.greetingMessage ? configured.greetingMessage : 'none'}
			• **farewell message**: ${configured.farewellMessage ? configured.farewellMessage : 'none'}
		`);
	}
}
