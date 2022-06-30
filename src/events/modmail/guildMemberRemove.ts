import { PrismaClient } from '@prisma/client';
import { Client, Events, GuildMember, PartialGuildMember, ThreadChannel } from 'discord.js';
import i18next from 'i18next';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';

@singleton()
export default class implements Event<typeof Events.GuildMemberRemove> {
	public readonly name = Events.GuildMemberRemove;

	public constructor(private readonly prisma: PrismaClient, private readonly client: Client<true>) {}

	public async handle(member: GuildMember | PartialGuildMember) {
		member = await member.fetch();

		const existingThread = await this.prisma.thread.findFirst({
			where: { guildId: member.guild.id, userId: member.id, closedById: null },
		});

		if (!existingThread) {
			return null;
		}

		try {
			const channel = (await this.client.channels.fetch(existingThread.channelId)) as ThreadChannel;
			await channel.send(i18next.t('thread.user_left'));
		} catch {}
	}
}
