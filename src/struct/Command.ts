import { basename, extname } from 'node:path';

export interface CommandInfo {
	name: string;
}

// TODO(DD): Generics and stuff for various interaction types
export interface Command {
	readonly name?: string;
	handle: () => unknown;
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
