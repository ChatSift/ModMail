import { basename, extname } from 'node:path';
import type { Awaitable, MessageComponentInteraction } from 'discord.js';

export type ComponentInfo = {
	name: string;
};

export type Component<Type extends MessageComponentInteraction<'cached'> = MessageComponentInteraction<'cached'>> = {
	handle(interaction: Type, ...args: any[]): Awaitable<unknown>;
	readonly name?: string;
};

export type ComponentConstructor = new (...args: any[]) => Component;

export function getComponentInfo(path: string): ComponentInfo | null {
	if (extname(path) !== '.js') {
		return null;
	}

	return { name: basename(path, '.js') };
}
