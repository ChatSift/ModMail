import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { Client, IntentsBitField } from 'discord.js';
import { container } from 'tsyringe';
import { CommandHandler } from './struct/CommandHandler';
import { EventHandler } from './struct/EventHandler';

const prisma = new PrismaClient();
const client = new Client({
	intents: [
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.DirectMessages,
		IntentsBitField.Flags.GuildMembers,
		IntentsBitField.Flags.DirectMessageTyping,
	],
});

container.register(PrismaClient, { useValue: prisma });
container.register(Client, { useValue: client });

await container.resolve(CommandHandler).init();
await container.resolve(EventHandler).init();

await client.login(process.env.DISCORD_TOKEN);
