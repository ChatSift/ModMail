import { chunkArray } from '@chatsift/utils';
import {
	ButtonStyle,
	type ComponentType,
	type ForumChannel,
	type MessageActionRowComponentBuilder,
	type MessageContextMenuCommandInteraction,
	type PermissionResolvable,
	ActionRowBuilder,
	ApplicationCommandType,
	ButtonBuilder,
	ChannelSelectMenuBuilder,
	PermissionsBitField,
	ChannelType,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getLocalizedProp, type CommandBody, type Command } from '../../struct/Command.js';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		...getLocalizedProp('name', 'context_menus.setup_prompt.name'),
		type: ApplicationCommandType.Message,
		default_member_permissions: String(PermissionsBitField.Flags.ManageGuild),
		dm_permission: false,
	};

	public requiredClientPermissions: PermissionResolvable = ['EmbedLinks', 'SendMessages'];

	public async handle(interaction: MessageContextMenuCommandInteraction<'cached'>) {
		if (!interaction.targetMessage.embeds.length) {
			return interaction.reply({
				content: i18next.t('common.errors.no_embeds'),
				ephemeral: true,
			});
		}

		const selectionInteraction = await interaction.reply({
			content: i18next.t('context_menus.setup_prompt.select_channel'),
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents([
					new ChannelSelectMenuBuilder()
						.setChannelTypes(ChannelType.GuildForum)
						.setCustomId('channel')
						.setMinValues(1)
						.setMaxValues(1),
				]),
			],
			ephemeral: true,
		});

		let channelSelection;
		try {
			channelSelection = await selectionInteraction.awaitMessageComponent<ComponentType.ChannelSelect>({
				filter: (received) => received.user.id === interaction.user.id,
				time: 60_000,
			});
		} catch {
			return interaction.editReply({
				content: i18next.t('common.errors.timed_out'),
				components: [],
			});
		}

		const channel = channelSelection.channels.first() as ForumChannel;
		const tags = channel.availableTags.filter((tag) => !tag.moderated);

		let wantTagButtons = tags.length > 0;
		if (wantTagButtons) {
			await channelSelection.update({
				content: i18next.t('context_menus.setup_prompt.confirm_want_tags'),
				components: [
					new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents([
						new ButtonBuilder().setCustomId('true').setStyle(ButtonStyle.Success).setLabel(i18next.t('common.yes')),
						new ButtonBuilder().setCustomId('false').setStyle(ButtonStyle.Danger).setLabel(i18next.t('common.no')),
					]),
				],
			});

			let confirmation;
			try {
				confirmation = await selectionInteraction.awaitMessageComponent<ComponentType.Button>({
					filter: (received) => received.user.id === interaction.user.id,
					time: 60_000,
				});
			} catch {
				return interaction.editReply({
					content: i18next.t('common.errors.timed_out'),
					components: [],
				});
			}

			await confirmation.update({
				content: i18next.t('context_menus.setup_prompt.creating'),
				components: [],
			});

			wantTagButtons = confirmation.customId === 'true';
		} else {
			await channelSelection.update({
				content: i18next.t('context_menus.setup_prompt.creating'),
				components: [],
			});
		}

		const buttons = wantTagButtons
			? tags.map((tag) => {
					const button = new ButtonBuilder()
						.setCustomId(`start-thread|${channel.id}|${tag.id}`)
						.setLabel(tag.name)
						.setStyle(ButtonStyle.Primary);

					if (tag.emoji) {
						button.setEmoji({
							id: tag.emoji.id ?? undefined,
							name: tag.emoji.name ?? undefined,
							animated: tag.emoji.name?.includes('<a:'),
						});
					}

					return button;
			  })
			: [
					new ButtonBuilder()
						.setCustomId(`start-thread|${channel.id}`)
						.setLabel(i18next.t('context_menus.setup_prompt.start_thread'))
						.setStyle(ButtonStyle.Primary),
			  ];

		const chunks = chunkArray(buttons, 5);
		const rows = chunks.map((chunk) => new ActionRowBuilder<MessageActionRowComponentBuilder>().setComponents(chunk));

		await interaction.channel!.send({
			embeds: interaction.targetMessage.embeds,
			components: rows,
		});

		return interaction.editReply({
			content: i18next.t('common.success.resource_creation', { resource: 'prompt' }),
		});
	}
}
