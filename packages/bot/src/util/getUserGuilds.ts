import { setTimeout } from 'node:timers';
import { PrismaClient } from '@prisma/client';
import type { Guild, Snowflake } from 'discord.js';
import { Client, Collection } from 'discord.js';
import { container } from 'tsyringe';
import { logger } from './logger.js';

export const ENABLED_CACHED_GUILDS = new Map<Snowflake, boolean>();
const NOT_IN_GUILD_CACHE = new Map<`${Snowflake}-${Snowflake}`, boolean>();

export async function getUserGuilds(userId: string): Promise<Collection<string, Guild>> {
	const client = container.resolve(Client);
	const prisma = container.resolve(PrismaClient);

	const cachedInGuilds = client.guilds.cache.reduce((acc, guild) => acc + (guild.members.cache.has(userId) ? 1 : 0), 0);
	logger.debug({ userId, enabledCacheSize: ENABLED_CACHED_GUILDS.size, cachedInGuilds }, 'Fetching guilds for user');

	const results = await Promise.all(
		Array.from(
			client.guilds.cache.filter((guild) => !NOT_IN_GUILD_CACHE.has(`${userId}-${guild.id}`)).values(),
			async (guild) =>
				guild.members
					.fetch(userId)
					.then(async () => {
						if (ENABLED_CACHED_GUILDS.get(guild.id)) {
							return [guild.id, guild];
						}

						const settings = await prisma.guildSettings.findFirst({ where: { guildId: guild.id } });
						if (settings?.modmailChannelId) {
							ENABLED_CACHED_GUILDS.set(guild.id, true);
							return [guild.id, guild];
						}

						ENABLED_CACHED_GUILDS.set(guild.id, false);
						return null;
					})
					.catch(() => {
						NOT_IN_GUILD_CACHE.set(`${userId}-${guild.id}`, true);
						setTimeout(
							() => {
								NOT_IN_GUILD_CACHE.delete(`${userId}-${guild.id}`);
							},
							10 * 60 * 1_000,
						).unref();

						return null;
					}),
		),
	);

	return new Collection(results.filter((result): result is [string, Guild] => result !== null));
}
