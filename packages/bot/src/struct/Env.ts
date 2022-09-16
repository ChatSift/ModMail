import process from "node:process";
import { singleton } from "tsyringe";

@singleton()
export class Env {
	public readonly discordToken = process.env.DISCORD_TOKEN!;

	public readonly discordClientId = process.env.DISCORD_CLIENT_ID!;

	public readonly isProd = process.env.NODE_ENV === "prod";

	public readonly deploySlashCommands = Boolean(process.env.DEPLOY);

	public readonly debugJobs = process.env.DEBUG_JOBS === "true";

	private readonly KEYS = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "NODE_ENV"] as const;

	public constructor() {
		for (const key of this.KEYS) {
			if (!(key in process.env)) {
				throw new Error(`Missing required environment variable: ${key}`);
			}
		}
	}
}
