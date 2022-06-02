import { basename, extname } from 'node:path';
import type { MessageComponentInteraction } from 'discord.js';

export interface ComponentInfo {
	name: string;
}

export interface Component<Type extends MessageComponentInteraction = MessageComponentInteraction> {
	readonly name?: string;
	handle: (interaction: Type, ...args: any[]) => unknown;
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
