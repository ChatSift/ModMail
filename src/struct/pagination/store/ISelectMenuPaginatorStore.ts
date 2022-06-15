import type { Awaitable } from 'discord.js';
import type { SelectMenuPaginatorState } from '../common';

export interface ISelectMenuPaginatorStore {
	get: (key: string) => Awaitable<SelectMenuPaginatorState | undefined>;
	setPage: (key: string, page: number) => Awaitable<void>;
	delete: (key: string) => Awaitable<boolean>;
}
