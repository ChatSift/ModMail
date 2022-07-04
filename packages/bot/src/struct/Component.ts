import { basename, extname } from 'node:path';
import type { Awaitable, MessageComponentInteraction } from 'discord.js';

export interface ComponentInfo {
	name: string;
}

export interface Component<Type extends MessageComponentInteraction<'cached'> = MessageComponentInteraction<'cached'>> {
	readonly name?: string;
	handle: (interaction: Type, ...args: any[]) => Awaitable<unknown>;
}

export type ComponentConstructor = new (...args: any[]) => Component;

export function getComponentInfo(path: string): ComponentInfo | null {
	if (extname(path) !== '.js') {
		return null;
	}

	return {
		name: basename(path, '.js'),
	};
}
