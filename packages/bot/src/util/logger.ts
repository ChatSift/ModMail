import { join } from 'node:path';
import process from 'node:process';
import type { PinoRotateFileOptions } from '@chatsift/pino-rotate-file';
import createLogger, { multistream, transport } from 'pino';
import type { PrettyOptions } from 'pino-pretty';

const pinoPrettyOptions: PrettyOptions = {
	colorize: true,
	levelFirst: true,
	translateTime: true,
};

const pinoRotateFileOptions: PinoRotateFileOptions = {
	dir: join(process.cwd(), 'logs', 'bot'),
	mkdir: true,
	maxAgeDays: 14,
	prettyOptions: {
		...pinoPrettyOptions,
		colorize: false,
	},
};

export const logger = createLogger(
	{
		name: 'BOT',
		level: 'trace',
	},
	multistream([
		{
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			stream: transport({
				target: 'pino-pretty',
				options: pinoPrettyOptions,
			}),
			level: 'trace',
		},
		{
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			stream: transport({
				target: '@chatsift/pino-rotate-file',
				options: pinoRotateFileOptions,
			}),
			level: 'trace',
		},
	]),
);
