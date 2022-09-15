import 'reflect-metadata';
import { on } from 'node:events';
import { parentPort } from 'node:worker_threads';
import type { ScheduledThreadClose, Thread } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { Payload } from '#struct/JobManager';
import { PayloadOpCode } from '#struct/JobManager';
import type { InferArrayT } from '#util/InferArrayT';
import { i18nInit } from '#util/i18nInit';
import process from 'node:process';

if (!parentPort) {
	console.warn('Something went wrong. This script should only be ran in a worker thread.');
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
	for await (const [message] of on(parentPort!, 'message') as AsyncIterableIterator<[Payload | string]>) {
		if (typeof message !== 'string' && message.op === PayloadOpCode.Done) {
			break;
		}
	}

	await prisma.thread.update({
		data: {
			closedById: thread.scheduledClose.scheduledById,
			closedAt: new Date(),
			scheduledClose: {
				delete: true,
			},
		},
		where: {
			threadId: thread.threadId,
		},
	});
}

await Promise.all(
	threads.map(async (thread) => {
		if (thread.scheduledClose.closeAt.getTime() < Date.now()) {
			return closeThread(thread);
		}

		return Promise.resolve();
	}),
);

parentPort?.postMessage('done');
