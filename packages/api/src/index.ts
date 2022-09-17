import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirRecurse } from '@chatsift/readdir';
import type { Route } from '@chatsift/rest-utils';
import { attachHttpUtils, sendBoom } from '@chatsift/rest-utils';
import { Boom, isBoom, notFound } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import helmet from 'helmet';
import type { Middleware } from 'polka';
import polka from 'polka';
import { container } from 'tsyringe';
import { Env } from './util/env';
import { logger } from './util/logger';

const env = container.resolve(Env);
container.register(PrismaClient, { useValue: new PrismaClient() });

const app = polka({
	onError(err, _, res) {
		res.setHeader('content-type', 'application/json');
		const boom = isBoom(err) ? err : new Boom(err);

		if (boom.output.statusCode === 500) {
			logger.error(boom, boom.message);
		}

		sendBoom(boom, res);
	},
	onNoMatch(_, res) {
		res.setHeader('content-type', 'application/json');
		sendBoom(notFound(), res);
	},
}).use(
	cors({
		origin: env.cors,
		credentials: true,
	}),
	helmet({ contentSecurityPolicy: env.isProd ? undefined : false }) as Middleware,
	attachHttpUtils(),
);

const path = join(dirname(fileURLToPath(import.meta.url)), 'routes');
const files = readdirRecurse(path, { fileExtensions: ['js'] });

for await (const file of files) {
	const mod = (await import(pathToFileURL(file).toString())) as { default?: new () => Route<any, any> };
	if (mod.default) {
		const route = container.resolve(mod.default);
		logger.info(route.info, 'Registering route');
		route.register(app);
	}
}

app.listen(env.port, () => logger.info(`Listening to requests on port ${env.port}`));

export * from './routeTypes';
