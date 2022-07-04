import {
	ApplicationCommandOptionChoiceData,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	AutocompleteInteraction,
	Client,
	type ChatInputCommandInteraction,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import ModmailMessageCreateHandler from '../events/modmail/modmailMessageCreate';
import { getLocalizedProp, type CommandBody, type Command } from '#struct/Command';
import { getUserGuilds } from '#util/getUserGuilds';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		...getLocalizedProp('name', 'commands.switch.name'),
		...getLocalizedProp('description', 'commands.switch.description'),
		type: ApplicationCommandType.ChatInput,
		dm_permission: true,
		default_member_permissions: '0',
		options: [
			{
				...getLocalizedProp('name', 'commands.switch.options.guild.name'),
				...getLocalizedProp('description', 'commands.switch.options.guild.description'),
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true,
			},
		],
	};

	public async handleAutocomplete(interaction: AutocompleteInteraction): Promise<ApplicationCommandOptionChoiceData[]> {
		const guilds = await getUserGuilds(interaction.user.id);
		const choices: ApplicationCommandOptionChoiceData[] = guilds.map((g) => ({ name: g.name, value: g.id }));

		const input = interaction.options.getFocused();
		const filtered = choices.filter((choice) => choice.name.includes(input));
		if (!filtered.length) {
			return [
				{
					name: i18next.t('common.errors.no_results'),
					value: 'noop',
				},
			];
		}

		return filtered;
	}

	public constructor(
		private readonly client: Client,
		private readonly modmailMessageCreateHandler: ModmailMessageCreateHandler,
	) {}

	public handle(interaction: ChatInputCommandInteraction) {
		if (interaction.guild) {
			return interaction.reply(i18next.t('common.errors.dm_only'));
		}

		const guildId = interaction.options.getString('guild', true);
		const guild = this.client.guilds.cache.get(guildId);
		if (!guild) {
			return interaction.reply(i18next.t('common.errors.no_guild'));
		}

		this.modmailMessageCreateHandler.overwriteUserSelection(interaction.user.id, guild.id);
		return interaction.reply(i18next.t('commands.switch.success'));
	}
}
