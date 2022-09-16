import type { Client } from "discord.js";
import { Events } from "discord.js";
import { singleton } from "tsyringe";
import type { Event } from "#struct/Event";
import { JobManager } from "#struct/JobManager";
import { logger } from "#util/logger";

@singleton()
export default class implements Event<typeof Events.ClientReady> {
	public readonly name = Events.ClientReady;

	public constructor(private readonly jobManager: JobManager) {}

	public async handle(client: Client<true>) {
		logger.info(`Ready as ${client.user.tag} (${client.user.id})`);
		await this.jobManager.register();
		await this.jobManager.start();
	}
}
