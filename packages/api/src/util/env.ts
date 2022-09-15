import { env } from 'node:process';
import { singleton } from 'tsyringe';

@singleton()
export class Env {
	public readonly port: number = parseInt(env.PORT ?? '8080', 10);

	public readonly isProd = env.NODE_ENV === 'prod';

	public readonly cors = env.CORS?.split(',') ?? [];

	private readonly KEYS: string[] = [];

	public constructor() {
		for (const key of this.KEYS) {
			if (!(key in env)) {
				throw new Error(`Missing required environment variable: ${key}`);
			}
		}
	}
}
