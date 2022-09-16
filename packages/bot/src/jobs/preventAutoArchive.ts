import "reflect-metadata";
import { on } from "node:events";
import process from "node:process";
import { parentPort } from "node:worker_threads";
import { PrismaClient } from "@prisma/client";
import type { Payload } from "#struct/JobManager";
import { PayloadOpCode } from "#struct/JobManager";

if (!parentPort) {
	console.warn("Something went wrong. This script should only be ran in a worker thread.");
	process.exit(0);
}

const prisma = new PrismaClient();

const threads = await prisma.thread.findMany({ where: { closedById: null } });

await Promise.all(
	threads.map(async (thread) => {
		const payload: Payload = {
			op: PayloadOpCode.UnarchiveThread,
			data: { channelId: thread.channelId },
		};

		parentPort!.postMessage(payload);
		for await (const [message] of on(parentPort!, "message") as AsyncIterableIterator<[Payload | string]>) {
			if (typeof message !== "string" && message.op === PayloadOpCode.Done) {
				break;
			}
		}
	}),
);

parentPort?.postMessage("done");
