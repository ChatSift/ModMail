import createLogger from 'pino';

export const logger = createLogger({
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
			levelFirst: true,
			translateTime: true,
		},
	},
});
