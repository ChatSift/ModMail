import { basename, extname } from 'node:path';
import type { ClientEvents } from 'discord.js';

export type Event<Name extends keyof ClientEvents = keyof ClientEvents> = {
	handle(...args: ClientEvents[Name]): unknown;
	readonly name?: Name;
};

export type EventConstructor = new (...args: any[]) => Event;

export type EventInfo = {
	name: string;
};

export function getEventInfo(path: string): EventInfo | null {
	if (extname(path) !== '.js') {
		return null;
	}

	return { name: basename(path, '.js') };
}
