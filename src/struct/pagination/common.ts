import type { APIButtonComponent, APISelectMenuComponent } from 'discord.js';
import type { ISelectMenuPaginatorStore } from './store/ISelectMenuPaginatorStore';

export interface SelectMenuPaginatorOptions {
	key: string;
	data?: unknown[];
	store?: ISelectMenuPaginatorStore;
	maxElementsPerPage?: number;
}

export interface SelectMenuPaginatorState {
	currentPage: number;
	readonly data: unknown[];
}

interface BaseSelectMenuPaginatorData extends SelectMenuPaginatorState {
	selectMenu: APISelectMenuComponent;
}

interface SelectMenuOptionsSelectMenuPaginatorData extends BaseSelectMenuPaginatorData {}

interface ButtonsSelectMenuPaginatorData extends BaseSelectMenuPaginatorData {
	pageLeftButton: APIButtonComponent;
	pageRightButton: APIButtonComponent;
}

export interface SelectMenuPaginatorConsumers {
	asSelectMenu: () => SelectMenuOptionsSelectMenuPaginatorData;
	asButtons: () => ButtonsSelectMenuPaginatorData;
}
