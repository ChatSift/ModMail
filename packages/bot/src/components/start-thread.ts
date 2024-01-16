import { PrismaClient } from '@prisma/client';
import type { GuildForumTag, Message, MessageActionRowComponentBuilder, ThreadChannel } from 'discord.js';
import {
	ChannelType,
	type ButtonInteraction,
	type ForumChannel,
	type TextChannel,
	ThreadAutoArchiveDuration,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import type { Component } from '../struct/Component';
import { ModMailHandler } from '../struct/ModMailHandler.js';
import { logger } from '../util/logger.js';

@singleton()
export default class implements Component<ButtonInteraction<'cached'>> {
	public readonly name = 'start-thread';

	public constructor(
		private readonly prisma: PrismaClient,
		private readonly modMailHandler: ModMailHandler,
	) {}

	private async createUserThreadChannel(
		interaction: ButtonInteraction<'cached'>,
	): Promise<[ThreadChannel, Message] | null> {
		try {
			// We assert that this button can only exist in a TextChannel in the handling of setup-prompt
			const thread = await (interaction.channel as TextChannel).threads.create({
				name: `${interaction.user.username}'s ModMail thread (${interaction.channel!.name})`,
				type: ChannelType.PrivateThread,
				autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
				invitable: false,
				reason: 'User started a ModMail thread',
			});

			const startingMessage = await thread.send({
				content: i18next.t('common.success.setting_up_notifcation', { user: interaction.user.toString() }),
			});

			return [thread, startingMessage];
		} catch (error) {
			logger.debug({ err: error }, 'Failed to create thread');

			await interaction.editReply({
				content: i18next.t('common.errors.could_not_create_thread'),
			});

			return null;
		}
	}

	private async createModThreadChannel(
		interaction: ButtonInteraction<'cached'>,
		forum: ForumChannel,
		tag?: GuildForumTag,
	): Promise<ThreadChannel | null> {
		try {
			const thread = await forum.threads.create({
				name: interaction.user.username,
				message: await this.modMailHandler.getStarterMessageData({ member: interaction.member }),
				appliedTags: tag ? [tag.id] : [],
				reason: 'User opened a ModMail thread',
				autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
			});

			await interaction.editReply({
				content: i18next.t('common.success.internal_thread_created'),
			});

			return thread;
		} catch {
			await interaction.editReply({
				content: i18next.t('common.errors.could_not_create_internal_thread'),
			});

			return null;
		}
	}

	public async handle(interaction: ButtonInteraction<'cached'>, channelId: string, tagId?: string) {
		const modForum = interaction.guild.channels.cache.get(channelId) as ForumChannel | undefined;
		if (!modForum) {
			return interaction.reply({
				content: i18next.t('common.errors.forum_not_found'),
				ephemeral: true,
			});
		}

		let tag;
		if (tagId) {
			tag = modForum.availableTags.find((tag) => tag.id === tagId);
			if (!tag) {
				return interaction.reply({
					content: i18next.t('common.errors.tag_not_found'),
					ephemeral: true,
				});
			}
		}

		await interaction.deferReply({ ephemeral: true });

		const existingThread = await this.prisma.threadv2.findFirst({
			where: {
				userId: interaction.user.id,
				closed: false,
			},
		});

		if (existingThread) {
			return interaction.editReply({
				content: i18next.t('common.errors.already_open_thread'),
			});
		}

		const userCreationResult = await this.createUserThreadChannel(interaction);
		if (!userCreationResult) {
			return null;
		}

		const [userThreadChannel, message] = userCreationResult;

		const modThreadChannel = await this.createModThreadChannel(interaction, modForum, tag);
		if (!modThreadChannel) {
			await message.edit({
				content: i18next.t('common.errors.could_not_create_internal_thread'),
			});

			return null;
		}

		await this.prisma.threadv2.create({
			data: {
				guildId: interaction.guild.id,
				promptChannelId: interaction.channelId,
				promptMessageId: interaction.message.id,
				userEndThreadId: userThreadChannel.id,
				modForumId: modForum.id,
				modEndThreadId: modThreadChannel.id,
				userId: interaction.user.id,
			},
		});

		await interaction.editReply({
			content: i18next.t('common.success.thread_created'),
		});

		await message.edit({
			content: i18next.t('common.success.thread_created_notification', { user: interaction.user.toString() }),
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('user-toggle-notifications|true')
						.setLabel(i18next.t('common.enable_notifications'))
						.setStyle(ButtonStyle.Success),
				),
			],
		});
	}
}
