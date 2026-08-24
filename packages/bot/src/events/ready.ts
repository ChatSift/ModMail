import { clearInterval, setInterval } from 'node:timers';
import type { Client } from 'discord.js';
import { ActivityType, Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '../struct/Event.js';
import { JobManager } from '../struct/JobManager.js';
import { logger } from '../util/logger.js';
import { migrationStatusText } from '../util/migrationNotice.js';

const PRESENCE_REFRESH_INTERVAL = 60 * 60 * 1_000;

@singleton()
export default class implements Event<typeof Events.ClientReady> {
	public readonly name = Events.ClientReady;

	private presenceRefreshInterval: NodeJS.Timeout | null = null;

	public constructor(private readonly jobManager: JobManager) {}

	public async handle(client: Client<true>) {
		logger.info(`Ready as ${client.user.tag} (${client.user.id})`);

		// See ChatSift/ChatSift#313 -- temporary, remove alongside `util/migrationNotice.ts` post-cutover.
		this.applyMigrationPresence(client);
		if (this.presenceRefreshInterval) {
			clearInterval(this.presenceRefreshInterval);
		}

		this.presenceRefreshInterval = setInterval(() => this.applyMigrationPresence(client), PRESENCE_REFRESH_INTERVAL);

		await this.jobManager.register();
		await this.jobManager.start();
	}

	private applyMigrationPresence(client: Client<true>): void {
		client.user.setPresence({
			activities: [{ name: 'Custom Status', type: ActivityType.Custom, state: migrationStatusText() }],
		});
	}
}
