import { fileURLToPath, URL } from "node:url";
import type { ScheduledThreadClose, Thread } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import Bree from "bree";
import type { ThreadChannel } from "discord.js";
import { Client } from "discord.js";
import { singleton } from "tsyringe";
import { closeThread } from "#util/closeThread";

// eslint-disable-next-line no-shadow
export enum PayloadOpCode {
	CloseThread,
	UnarchiveThread,
	Done,
}

export type Payload =
	| {
			data: {
				channelId: string;
			};
			op: PayloadOpCode.UnarchiveThread;
	}
	| {
			data: Thread & {
				scheduledClose: ScheduledThreadClose;
			};
			op: PayloadOpCode.CloseThread;
	}
	| {
			op: PayloadOpCode.Done;
	};

@singleton()
export class JobManager {
	public constructor(
		private readonly bree: Bree,
		private readonly client: Client,
		private readonly prisma: PrismaClient,
	) {}

	public async register() {
		await this.bree.add({
			name: "autoCloseThreads",
			interval: "5s",
			path: fileURLToPath(new URL("../jobs/autoCloseThreads.js", import.meta.url)),
		});

		await this.bree.add({
			name: "autoUnblock",
			interval: "1m",
			path: fileURLToPath(new URL("../jobs/autoUnblock.js", import.meta.url)),
		});

		await this.bree.add({
			name: "preventAutoArchive",
			interval: "5m",
			path: fileURLToPath(new URL("../jobs/preventAutoArchive.js", import.meta.url)),
		});
	}

	public async start() {
		this.bree.on("worker created", (name: string) => {
			const worker = this.bree.workers.get(name);

			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			worker?.on("message", async (message: Payload | string) => {
				if (typeof message === "string") {
					return;
				}

				switch (message.op) {
				case PayloadOpCode.CloseThread: {
					const channel = (await this.client.channels
						.fetch(message.data.channelId)
						.catch(() => null)) as ThreadChannel | null;

					if (channel) {
						await closeThread({
							thread: message.data,
							channel,
							silent: message.data.scheduledClose.silent,
						});
					}

					const payload: Payload = { op: PayloadOpCode.Done };
					worker.postMessage(payload);
					break;
				}

				case PayloadOpCode.UnarchiveThread: {
					const channel = (await this.client.channels
						.fetch(message.data.channelId)
						.catch(() => null)) as ThreadChannel | null;

					if (channel?.archived) {
						await channel.setArchived(false);
					}

					const payload: Payload = { op: PayloadOpCode.Done };
					worker.postMessage(payload);
					break;
				}

				case PayloadOpCode.Done: {
					// Noop, this one is meant only for sending
					break;
				}

				default:
				}
			});
		});

		this.bree.on("worker deleted", (name: string) => {
			this.bree.workers.get(name)?.removeAllListeners();
		});

		await this.bree.start();
	}
}
