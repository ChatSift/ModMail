import { env } from 'node:process';
import { singleton } from 'tsyringe';

@singleton()
export class Env {
	public readonly discordToken = env.DISCORD_TOKEN!;

	public readonly discordClientId = env.DISCORD_CLIENT_ID!;

	public readonly isProd = env.NODE_ENV === 'prod';

	public readonly deploySlashCommands = Boolean(env.DEPLOY);

	public readonly debugJobs = env.DEBUG_JOBS === 'true';

	private readonly KEYS = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'NODE_ENV'] as const;

	public constructor() {
		for (const key of this.KEYS) {
			if (!(key in env)) {
				throw new Error(`Missing required environment variable: ${key}`);
			}
		}
	}
}
