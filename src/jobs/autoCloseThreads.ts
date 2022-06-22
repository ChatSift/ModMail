import { on } from 'node:events';
import { parentPort } from 'node:worker_threads';
import { PrismaClient, ScheduledThreadClose, Thread } from '@prisma/client';
import { Payload, PayloadOpCode } from '../struct/JobManager';
import type { InferArrayT } from '#util/InferArrayT';
import { i18nInit } from '#util/i18nInit';

if (!parentPort) {
	console.warn('Something went wrong. This script should only be run in a worker thread.');
	process.exit(0);
}

const prisma = new PrismaClient();

await i18nInit();

const threads = (await prisma.thread.findMany({
	where: { scheduledClose: { isNot: null } },
	include: { scheduledClose: true },
})) as (Thread & {
	scheduledClose: ScheduledThreadClose;
})[];

async function closeThread(thread: InferArrayT<typeof threads>) {
	const payload: Payload = {
		op: PayloadOpCode.CloseThread,
		data: thread,
	};

	parentPort!.postMessage(payload);
	for await (const message of on(parentPort!, 'message') as AsyncIterableIterator<string | Payload>) {
		if (typeof message !== 'string' && message.op === PayloadOpCode.Done) {
			break;
		}
	}
}

await Promise.all(
	threads.map((thread) => {
		if (thread.scheduledClose.closeAt.getTime() < Date.now()) {
			return closeThread(thread);
		}

		return Promise.resolve();
	}),
);

parentPort.postMessage('done');
