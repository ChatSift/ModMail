import process from 'node:process';
import { singleton } from 'tsyringe';

@singleton()
export class Env {
	public readonly port: number = Number.parseInt(process.env.PORT ?? '8080', 10);

	public readonly isProd = process.env.NODE_ENV === 'prod';

	public readonly cors = process.env.CORS?.split(',') ?? [];

	private readonly KEYS: string[] = [];

	public constructor() {
		for (const key of this.KEYS) {
			if (!(key in process.env)) {
				throw new Error(`Missing required environment variable: ${key}`);
			}
		}
	}
}
