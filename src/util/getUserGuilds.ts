import { Client, Collection, Guild } from 'discord.js';
import { container } from 'tsyringe';

export async function getUserGuilds(userId: string): Promise<Collection<string, Guild>> {
	const client = container.resolve(Client);
	const results = await Promise.all(
		Array.from(client.guilds.cache.values(), (guild) =>
			guild.members
				.fetch(userId)
				.then(() => [guild.id, guild])
				.catch(() => null),
		),
	);

	return new Collection(results.filter((result): result is [string, Guild] => result !== null));
}
