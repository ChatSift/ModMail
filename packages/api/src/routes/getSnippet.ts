import { Route, RouteMethod } from '@chatsift/rest-utils';
import { badRequest, notFound } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import type { Middleware, NextHandler, Request, Response } from 'polka';
import { singleton } from 'tsyringe';
import type { Snippet } from '../util/models';

@singleton()
export default class extends Route<Snippet, never> {
	public info = {
		method: RouteMethod.get,
		path: '/modmail/v1/guilds/:guildId/snippets/:snippetId',
	} as const;

	public override middleware: Middleware[] = [];

	public constructor(private readonly prisma: PrismaClient) {
		super();
	}

	public async handle(req: Request, res: Response, next: NextHandler) {
		const { guildId, snippetId } = req.params as { guildId: string; snippetId: string };

		const snippetIdNum = Number.parseInt(snippetId, 10);
		if (Number.isNaN(snippetIdNum)) {
			return next(badRequest('Invalid snippet ID'));
		}

		const snippet = await this.prisma.snippet.findFirst({
			where: {
				guildId,
				snippetId: snippetIdNum,
			},
		});
		if (!snippet) {
			return next(notFound('Snippet not found'));
		}

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(snippet));
	}
}
