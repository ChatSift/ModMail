import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirRecurse } from '@chatsift/readdir';
import { container, singleton } from 'tsyringe';
import { Command, CommandConstructor, getCommandInfo } from './Command';

@singleton()
export class CommandHandler {
	private readonly commands = new Map<string, Command>();

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
}
