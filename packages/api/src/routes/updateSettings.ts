import { Route, RouteMethod, TRequest } from '@chatsift/rest-utils';
import { PrismaClient } from '@prisma/client';
import { BaseValidator, InferType, s } from '@sapphire/shapeshift';
import type { Response } from 'polka';
import { singleton } from 'tsyringe';
import type { GuildSettings } from '../util/models';
import { snowflakeSchema } from '../util/snowflakeSchema';

const schema = s.object({
	modMailChannelId: snowflakeSchema.nullish,
	greetingMessage: s.string.lengthGreaterThan(0).lengthLessThanOrEqual(1900).nullish,
	farewellMessage: s.string.lengthGreaterThan(0).lengthLessThanOrEqual(1900).nullish,
	simpleMode: s.boolean.optional,
	alertRoleId: snowflakeSchema.nullish,
}).strict;
type Body = InferType<typeof schema>;

@singleton()
export default class extends Route<GuildSettings, Body> {
	public info = {
		method: RouteMethod.patch,
		path: '/guilds/:guildId/settings/',
	} as const;

	public override readonly bodyValidationSchema: BaseValidator<Body> = schema;

	public constructor(private readonly prisma: PrismaClient) {
		super();
	}

	public async handle(req: TRequest<typeof schema>, res: Response) {
		const { guildId } = req.params as { guildId: string };
		const data = req.body as Body;

		const guildSettings = await this.prisma.guildSettings.upsert({
			create: {
				guildId,
				...data,
			},
			update: data,
			where: { guildId },
		});

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(guildSettings));
	}
}
