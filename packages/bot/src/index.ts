import 'reflect-metadata';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';
import Bree from 'bree';
import { Client, IntentsBitField, Options, Partials } from 'discord.js';
import { container } from 'tsyringe';
import { deploySlashCommands } from './deploy.js';
import { CommandHandler } from './struct/CommandHandler.js';
import { Env } from './struct/Env.js';
import { EventHandler } from './struct/EventHandler.js';
import { i18nInit } from './util/i18nInit.js';

const env = container.resolve(Env);

const client = new Client({
	intents: [
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.DirectMessages,
		IntentsBitField.Flags.DirectMessageTyping,
		IntentsBitField.Flags.GuildMessages,
		IntentsBitField.Flags.MessageContent,
	],
	partials: [Partials.Channel, Partials.Message],
	makeCache: Options.cacheWithLimits({ MessageManager: 100 }),
}).setMaxListeners(20);
container.register(Client, { useValue: client });
container.register(PrismaClient, { useValue: new PrismaClient() });
// Because apparently bree can't deal with me doing logger: undefiend
const breeOptions: Bree.BreeOptions = { root: false };
if (!env.debugJobs) {
	breeOptions.logger = false;
}

container.register(Bree, { useValue: new Bree(breeOptions) });

await i18nInit();

if (env.deploySlashCommands) {
	await deploySlashCommands();
	process.exit(0);
}

await container.resolve(CommandHandler).init();
await container.resolve(EventHandler).init();

await client.login(env.discordToken);
