import type { TRequest } from '@chatsift/rest-utils';
import { jsonParser, Route, RouteMethod } from '@chatsift/rest-utils';
import { REST } from '@discordjs/rest';
import { badRequest, notFound } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import type { BaseValidator, InferType } from '@sapphire/shapeshift';
import { s } from '@sapphire/shapeshift';
import type { RESTPatchAPIApplicationGuildCommandJSONBody } from 'discord-api-types/v9';
import { Routes } from 'discord-api-types/v9';
import type { Middleware, Response } from 'polka';
import { singleton } from 'tsyringe';
import { Env } from '../util/env';
import type { Snippet } from '../util/models';
import { snowflakeSchema } from '../util/snowflakeSchema';

const schema = s.object({
	name: s.string.lengthGreaterThan(0).lengthLessThanOrEqual(32).optional,
	content: s.string.lengthGreaterThan(0).lengthLessThanOrEqual(1_900).optional,
	updatedById: snowflakeSchema,
}).strict;
type Body = InferType<typeof schema>;

@singleton()
export default class extends Route<Snippet, Body> {
	public info = {
		method: RouteMethod.patch,
		path: '/modmail/v1/guilds/:guildId/snippets/:snippetId',
	} as const;

	public override readonly bodyValidationSchema: BaseValidator<Body> = schema;

	public override middleware: Middleware[] = [jsonParser()];

	public constructor(
		private readonly prisma: PrismaClient,
		private readonly discordRest: REST,
		private readonly env: Env,
	) {
		super();
	}

	public async handle(req: TRequest<Body>, res: Response) {
		const { guildId, snippetId } = req.params as { guildId: string; snippetId: string };

		const snippetIdNum = Number.parseInt(snippetId, 10);
		if (Number.isNaN(snippetIdNum)) {
			throw badRequest('Invalid snippet ID');
		}

		const snippet = await this.prisma.snippet.findFirst({
			where: {
				snippetId: snippetIdNum,
			},
		});
		if (!snippet) {
			throw notFound('Snippet not found');
		}

		await this.discordRest.patch(Routes.applicationGuildCommand(this.env.discordClientId, guildId, snippet.commandId), {
			body: req.body as RESTPatchAPIApplicationGuildCommandJSONBody,
		});

		const [updatedSnippet] = await this.prisma.$transaction([
			this.prisma.snippet.update({
				where: {
					snippetId: snippetIdNum,
				},
				data: {
					name: req.body.name,
					content: req.body.content,
				},
			}),
			this.prisma.snippetUpdates.create({
				data: {
					snippet: {
						connect: {
							snippetId: snippetIdNum,
						},
					},
					oldContent: snippet.content,
					updatedBy: req.body.updatedById,
				},
			}),
		]);

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(updatedSnippet));
	}
}
