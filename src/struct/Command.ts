import { basename, extname } from 'node:path';
import type { CommandInteraction, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

export interface CommandInfo {
	name: string;
}

export interface Command {
	readonly name?: string;
	readonly interactionOptions: RESTPostAPIApplicationCommandsJSONBody;
	handle: (interaction: CommandInteraction) => unknown;
}

export type CommandConstructor = new (...args: any[]) => Command;

export function getCommandInfo(path: string): CommandInfo | null {
	if (extname(path) !== '.js') {
		return null;
	}

	return {
		name: basename(path, '.js'),
	};
}
