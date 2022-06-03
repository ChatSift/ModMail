import 'reflect-metadata';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Client, IntentsBitField } from 'discord.js';
import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';
import { container } from 'tsyringe';
import { deploySlashCommands } from './deploy';
import { CommandHandler } from '#struct/CommandHandler';
import { Env } from '#struct/Env';
import { EventHandler } from '#struct/EventHandler';

const client = new Client({
	intents: [
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.DirectMessages,
		IntentsBitField.Flags.GuildMembers,
		IntentsBitField.Flags.DirectMessageTyping,
	],
});
container.register(Client, { useValue: client });
container.register(PrismaClient, { useValue: new PrismaClient() });

await i18next.use(FsBackend).init({
	backend: {
		loadPath: join(process.cwd(), 'locales', '{{lng}}', '{{ns}}.json'),
	},
	cleanCode: true,
	fallbackLng: ['en-US'],
	defaultNS: 'translation',
	lng: 'en-US',
	ns: ['translation'],
});

const env = container.resolve(Env);
if (env.deploySlashCommands) {
	await deploySlashCommands();
	process.exit(0);
}

await container.resolve(CommandHandler).init();
await container.resolve(EventHandler).init();

await client.login(process.env.DISCORD_TOKEN);
