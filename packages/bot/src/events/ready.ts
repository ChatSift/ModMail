import type { Client } from 'discord.js';
import { Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '../struct/Event.js';
import { JobManager } from '../struct/JobManager.js';
import { logger } from '../util/logger.js';

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
