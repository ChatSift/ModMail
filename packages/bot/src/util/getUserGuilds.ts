import { PrismaClient } from "@prisma/client";
import type { Guild } from "discord.js";
import { Client, Collection } from "discord.js";
import { container } from "tsyringe";

export async function getUserGuilds(userId: string): Promise<Collection<string, Guild>> {
	const client = container.resolve(Client);
	const prisma = container.resolve(PrismaClient);

	const results = await Promise.all(
		Array.from(client.guilds.cache.values(), async (guild) => guild.members
			.fetch(userId)
			.then(async () => {
				const settings = await prisma.guildSettings.findFirst({ where: { guildId: guild.id } });
				if (settings?.modmailChannelId) {
					return [guild.id, guild];
				}

				return null;
			})
			.catch(() => null)),
	);

	return new Collection(results.filter((result): result is [string, Guild] => result !== null));
}
