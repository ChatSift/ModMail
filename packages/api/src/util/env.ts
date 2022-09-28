import process from 'node:process';
import { singleton } from 'tsyringe';

@singleton()
export class Env {
	public readonly port: number = Number.parseInt(process.env.PORT ?? '8080', 10);

	public readonly discordToken: string = process.env.DISCORD_TOKEN!;

	public readonly discordClientId: string = process.env.DISCORD_CLIENT_ID!;

	public readonly isProd = process.env.NODE_ENV === 'prod';

	public readonly cors = process.env.CORS?.split(',') ?? [];

	private readonly KEYS: string[] = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];

	public constructor() {
		for (const key of this.KEYS) {
			if (!(key in process.env)) {
				throw new Error(`Missing required environment variable: ${key}`);
			}
		}
	}
}
