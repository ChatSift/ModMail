import type { TRequest } from '@chatsift/rest-utils';
import { Route, RouteMethod } from '@chatsift/rest-utils';
import { REST } from '@discordjs/rest';
import { badRequest, notFound } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import type { BaseValidator, InferType } from '@sapphire/shapeshift';
import { s } from '@sapphire/shapeshift';
import { Routes } from 'discord-api-types/v10';
import type { NextHandler, Request, Response } from 'polka';
import { singleton } from 'tsyringe';
import { Env } from '../util/env.js';
import type { Snippet } from '../util/models';
import { snowflakeSchema } from '../util/snowflakeSchema.js';

@singleton()
export default class extends Route<Snippet, never> {
	public info = {
		method: RouteMethod.delete,
		path: '/modmail/v1/guilds/:guildId/snippets/:snippetId',
	} as const;

	public constructor(
		private readonly prisma: PrismaClient,
		private readonly discordRest: REST,
		private readonly env: Env,
	) {
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
				snippetId: snippetIdNum,
			},
		});
		if (!snippet) {
			return next(notFound('Snippet not found'));
		}

		await this.discordRest.delete(Routes.applicationGuildCommand(this.env.discordClientId, guildId, snippet.commandId));

		const deletedSnippet = await this.prisma.snippet.delete({
			where: {
				snippetId: snippetIdNum,
			},
		});

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(deletedSnippet));
	}
}
