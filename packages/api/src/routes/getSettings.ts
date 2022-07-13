import { Route, RouteMethod } from '@chatsift/rest-utils';
import { PrismaClient } from '@prisma/client';
import type { Middleware, Request, Response } from 'polka';
import { singleton } from 'tsyringe';
import type { GuildSettings } from '../util/models';

@singleton()
export default class extends Route<GuildSettings, never> {
	public info = {
		method: RouteMethod.get,
		path: '/modmail/v1/guilds/:guildId/settings/',
	} as const;

	public override middleware: Middleware[] = [];

	public constructor(private readonly prisma: PrismaClient) {
		super();
	}

	public async handle(req: Request, res: Response) {
		const { guildId } = req.params as { guildId: string };
		const guildSettings = await this.prisma.guildSettings.upsert({
			create: { guildId },
			update: {},
			where: { guildId },
		});

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(guildSettings));
	}
}
