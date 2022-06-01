import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirRecurse } from '@chatsift/readdir';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import { container, singleton } from 'tsyringe';
import { Command, CommandConstructor, getCommandInfo } from './Command';
import { Env } from './Env';

@singleton()
export class CommandHandler {
	private readonly commands = new Map<string, Command>();

	public constructor(private readonly env: Env) {}

	public async init(): Promise<void> {
		const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'commands');
		const files = readdirRecurse(path, { fileExtensions: ['js'] });

		for await (const file of files) {
			const info = getCommandInfo(file);
			if (!info) {
				continue;
			}

			const mod = (await import(file)) as { default: CommandConstructor };
			const command = container.resolve(mod.default);
			const name = command.name ?? info.name;

			this.commands.set(name, command);
		}
	}

	public async registerDevInteractions(): Promise<void> {
		const api = new REST().setToken(this.env.discordToken);
		const options = [...this.commands.values()].map((command) => command.interactionOptions);

		const promises: Promise<unknown>[] = [];
		for (const guildId of this.env.testGuildIds ?? []) {
			promises.push(
				api.put(Routes.applicationGuildCommands(this.env.discordClientId, guildId), {
					body: options,
				}),
			);
		}

		await Promise.all(promises);
	}

	public async registerProdInteractions(): Promise<void> {
		const api = new REST().setToken(this.env.discordToken);
		const options = [...this.commands.values()].map((command) => command.interactionOptions);
		await api.put(Routes.applicationCommands(this.env.discordClientId), { body: options });
	}
}
