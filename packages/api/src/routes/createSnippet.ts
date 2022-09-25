import type { TRequest } from '@chatsift/rest-utils';
import { Route, RouteMethod } from '@chatsift/rest-utils';
import { REST } from '@discordjs/rest';
import { PrismaClient } from '@prisma/client';
import type { BaseValidator, InferType } from '@sapphire/shapeshift';
import { s } from '@sapphire/shapeshift';
import type {
	RESTPostAPIApplicationCommandsResult,
	RESTPostAPIApplicationGuildCommandsJSONBody,
} from 'discord-api-types/v9';
import { ApplicationCommandOptionType, Routes } from 'discord-api-types/v9';
import type { Response } from 'polka';
import { singleton } from 'tsyringe';
import { Env } from '../util/env';
import type { Snippet } from '../util/models';
import { snowflakeSchema } from '../util/snowflakeSchema';

const schema = s.object({
	name: s.string.lengthGreaterThan(0).lengthLessThanOrEqual(32),
	content: s.string.lengthGreaterThan(0).lengthLessThanOrEqual(1_900),
	createdById: snowflakeSchema,
}).strict;
type Body = InferType<typeof schema>;

@singleton()
export default class extends Route<Snippet, Body> {
	public info = {
		method: RouteMethod.put,
		path: '/modmail/v1/guilds/:guildId/snippets/',
	} as const;

	public override readonly bodyValidationSchema: BaseValidator<Body> = schema;

	public constructor(
		private readonly prisma: PrismaClient,
		private readonly discordRest: REST,
		private readonly env: Env,
	) {
		super();
	}

	public async handle(req: TRequest<Body>, res: Response) {
		const { guildId } = req.params as { guildId: string };

		const snipptetCommandData: RESTPostAPIApplicationGuildCommandsJSONBody = {
			name: req.body.name,
			description: 'This is a local snippet',
			default_member_permissions: '0',
			options: [
				{
					name: 'anon',
					description: 'Whether or not to send the message as anonymous - defaults to false',
					type: ApplicationCommandOptionType.Boolean,
				},
			],
		};
		const snippetCommand = (await this.discordRest.post(
			Routes.applicationGuildCommands(this.env.discordClientId, guildId),
			{
				body: snipptetCommandData,
			},
		)) as RESTPostAPIApplicationCommandsResult;

		const snippets = await this.prisma.snippet.create({
			data: {
				name: req.body.name,
				content: req.body.content,
				createdById: req.body.createdById,
				commandId: snippetCommand.id,
				guildId,
			},
		});

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(snippets));
	}
}
