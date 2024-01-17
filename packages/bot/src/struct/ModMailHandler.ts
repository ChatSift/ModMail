import { EventEmitter, on } from 'node:events';
import { setTimeout } from 'node:timers';
import { PrismaClient, type GuildSettings, type Threadv2 } from '@prisma/client';
import type { MessageCreateOptions, ThreadChannel, User } from 'discord.js';
import {
	type Message,
	type BaseMessageOptions,
	type GuildMember,
	Colors,
	TimestampStyles,
	time,
	EmbedBuilder,
	bold,
	quote,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getSortedMemberRolesString } from '../util/getSortedMemberRoles.js';
import { logger } from '../util/logger.js';

interface ModMailChannelEmitter extends EventEmitter {
	emit(event: 'messageCreate', message: Message<true>, thread: Threadv2): boolean;
	on(event: 'messageCreate', listener: (message: Message<true>, thread: Threadv2) => void): this;
}

declare module 'node:events' {
	class EventEmitter {
		public static on(
			eventEmitter: ModMailChannelEmitter,
			eventName: 'messageCreate',
		): AsyncIterableIterator<[Message<true>, Threadv2]>;
	}
}

@singleton()
export class ModMailHandler {
	private readonly emitters = new Map<string, ModMailChannelEmitter>();

	public constructor(private readonly prisma: PrismaClient) {}

	// Efectively a glorified caller for the next 2 methods
	public handle(message: Message<true>, thread: Threadv2): void {
		const emitter = this.assertEmitter(message);
		emitter.emit('messageCreate', message, thread);
	}

	private async handleUserMessageCreate(message: Message<true>, thread: Threadv2): Promise<void> {
		logger.debug('Handling user message', { message, thread });

		if (message.content.length > 3_800) {
			await message.reply({
				content: i18next.t('common.errors.message_too_long'),
				allowedMentions: { repliedUser: false },
			});

			return;
		}

		const settings = await this.prisma.guildSettings.findFirst({
			where: {
				guildId: thread.guildId,
			},
		});

		const targetChannel = (await message.guild.channels.fetch(thread.modEndThreadId).catch((error) => {
			logger.error('No target channel found for ModMailHandler->handleUserMessageCreate', {
				err: error,
				message,
				thread,
			});
			return null;
		})) as ThreadChannel | null;

		if (!targetChannel) {
			await message.reply({
				content: i18next.t('common.errors.message_forward'),
				allowedMentions: { repliedUser: false },
			});

			return;
		}

		const sentMessage = await targetChannel
			.send(
				settings?.simpleMode ?? false
					? this.getSimpleModeMessageData({ message })
					: this.getEmbedModeMessageData({ message }),
			)
			.catch((error) => {
				logger.error('Failed to forward user message in ModMailHandler->handleUserMessageCreate', {
					err: error,
					message,
					thread,
				});

				return null;
			});
	}

	private getSimpleModeMessageData({ message }: { message: Message }): MessageCreateOptions {
		const options: MessageCreateOptions = {};

		if (message.content.length) {
			options.content = `${bold(`${message.author.tag}:`)} ${message.content}`;
		}

		if (message.attachments.size) {
			options.files = [...message.attachments.values()];
		}

		if (message.stickers.size) {
			options.content += `\n\n${quote(i18next.t('common.has_stickers'))}`;
		}

		return options;
	}

	private getEmbedModeMessageData({ message }: { message: Message<true> }): MessageCreateOptions {
		const embed = new EmbedBuilder()
			.setColor(Colors.Green)
			.setDescription(message.content.length ? message.content : null)
			.setImage(message.attachments.first()?.url ?? null)
			.setFooter({
				text: `${message.member!.user.tag} (${message.member!.user.id})`,
				iconURL: message.member!.user.displayAvatarURL(),
			});

		if (message.member!.nickname) {
			embed.setAuthor({
				name: message.member!.nickname,
				iconURL: message.member!.displayAvatarURL(),
			});
		}

		return {
			content: message.stickers.size ? quote(i18next.t('common.has_stickers')) : undefined,
			embeds: [embed],
		};
	}

	public async getStarterMessageData({
		member,
		openedByMod,
	}: {
		member: GuildMember;
		openedByMod?: User;
	}): Promise<BaseMessageOptions> {
		const pastModmails = await this.prisma.thread.findMany({
			where: {
				guildId: member.guild.id,
				userId: member.id,
			},
		});

		const embed = new EmbedBuilder()
			.setFooter({
				text: `${member.user.tag} (${member.user.id})`,
				iconURL: member.user.displayAvatarURL(),
			})
			.setColor(Colors.NotQuiteBlack)
			.addFields(
				{
					name: i18next.t('thread.start.embed.fields.account_created'),
					value: time(member.user.createdAt, TimestampStyles.LongDate),
					inline: true,
				},
				{
					name: i18next.t('thread.start.embed.fields.joined_server'),
					value: time(member.joinedAt!, TimestampStyles.LongDate),
					inline: true,
				},
				{
					name: i18next.t('thread.start.embed.fields.past_modmails'),
					value: pastModmails.length.toString(),
					inline: true,
				},
			);

		if (openedByMod) {
			embed.addFields({
				name: i18next.t('thread.start.embed.fields.opened_by'),
				value: openedByMod.toString(),
				inline: true,
			});
		}

		embed.addFields({
			name: i18next.t('thread.start.embed.fields.roles'),
			value: getSortedMemberRolesString(member),
			inline: true,
		});

		if (member.nickname) {
			embed.setAuthor({
				name: member.nickname,
				iconURL: member.displayAvatarURL(),
			});
		}

		return {
			embeds: [embed],
		};
	}

	private assertEmitter(message: Message): ModMailChannelEmitter {
		if (this.emitters.has(message.channel.id)) {
			return this.emitters.get(message.channel.id)!;
		}

		const emitter: ModMailChannelEmitter = new EventEmitter().setMaxListeners(1);
		const timeout = setTimeout(() => {
			emitter.removeAllListeners();
			this.emitters.delete(message.channel.id);
		}, 60_000).unref();

		void this.setupHandler(emitter, timeout);

		this.emitters.set(message.channel.id, emitter);
		return emitter;
	}

	private async setupHandler(emitter: ModMailChannelEmitter, timeout: NodeJS.Timeout): Promise<void> {
		for await (const [message, thread] of on(emitter, 'messageCreate')) {
			timeout.refresh();
			await this.handleUserMessageCreate(message, thread);
		}
	}
}
