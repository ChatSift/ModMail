import { EventEmitter, on } from 'node:events';
import { setTimeout } from 'node:timers';
import { PrismaClient, type GuildSettings, type Threadv2 } from '@prisma/client';
import type { User } from 'discord.js';
import {
	type Message,
	type BaseMessageOptions,
	type GuildMember,
	Colors,
	TimestampStyles,
	time,
	EmbedBuilder,
} from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import { getSortedMemberRolesString } from '../util/getSortedMemberRoles.js';
import { logger } from '../util/logger.js';

interface ModMailChannelEmitter extends EventEmitter {
	emit(event: 'message', message: Message, thread: Threadv2): boolean;
	on(event: 'message', listener: (message: Message, thread: Threadv2) => void): this;
}

declare module 'node:events' {
	class EventEmitter {
		public static on(
			eventEmitter: ModMailChannelEmitter,
			eventName: 'message',
		): AsyncIterableIterator<[Message, Threadv2]>;
	}
}

@singleton()
export class ModMailHandler {
	private readonly emitters = new Map<string, ModMailChannelEmitter>();

	public constructor(private readonly prisma: PrismaClient) {}

	public handle(message: Message, thread: Threadv2): void {
		const emitter = this.assertEmitter(message);
		emitter.emit('message', message, thread);
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
		for await (const [message, thread] of on(emitter, 'message')) {
			timeout.refresh();
			await this.handleUserMessage(message, thread);
		}
	}

	private async handleUserMessage(message: Message, thread: Threadv2): Promise<void> {
		logger.debug('Handling user message', { message, thread });
	}
}
