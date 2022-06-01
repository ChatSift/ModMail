import { singleton } from 'tsyringe';

@singleton()
export class Env {
	public readonly discordToken = process.env.DISCORD_TOKEN!;
	public readonly discordClientId = process.env.DISCORD_CLIENT_ID!;
	public readonly testGuildIds = process.env.TEST_GUILD_IDS?.split(',');
	public readonly isProd = process.env.NODE_ENV === 'prod';
	public readonly deploySlashCommands = Boolean(process.env.DEPLOY);

	private readonly KEYS = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'NODE_ENV'] as const;

	public constructor() {
		for (const key of this.KEYS) {
			if (!(key in process.env)) {
				throw new Error(`Missing required environment variable: ${key}`);
			}
		}
	}
}
