import { ButtonBuilder, SelectMenuBuilder } from '@discordjs/builders';
import { ButtonStyle, If } from 'discord.js';

export interface SelectMenuPaginatorOptions {
	key: string;
	data?: unknown[];
	store?: Map<string, SelectMenuPaginatorState>;
	maxElementsPerPage?: number;
}

export interface SelectMenuPaginatorState {
	currentPage: number;
	readonly data: unknown[];
}

interface BaseSelectMenuPaginatorData extends SelectMenuPaginatorState {
	selectMenu: SelectMenuBuilder;
}

interface SelectMenuOptionsSelectMenuPaginatorData extends BaseSelectMenuPaginatorData {}

interface ButtonsSelectMenuPaginatorData extends BaseSelectMenuPaginatorData {
	pageLeftButton: ButtonBuilder;
	pageRightButton: ButtonBuilder;
}

export interface SelectMenuPaginatorConsumers {
	asSelectMenu: () => SelectMenuOptionsSelectMenuPaginatorData;
	asButtons: () => ButtonsSelectMenuPaginatorData;
}

export class SelectMenuPaginator<Data = unknown, Asserted extends boolean = Data extends any[] ? true : false> {
	private readonly key: string;
	private state!: If<Asserted, SelectMenuPaginatorState>;
	private readonly store?: Map<string, SelectMenuPaginatorState>;
	private readonly maxElementsPerPage: number;

	public constructor(options: SelectMenuPaginatorOptions & { data?: Data }) {
		if (options.data) {
			(this as SelectMenuPaginator<Data, true>).state = { currentPage: 0, data: options.data };
		} else {
			(this as SelectMenuPaginator<Data, false>).state = null;
		}
		this.key = options.key;
		this.store = options.store;
		if (options.maxElementsPerPage != null && (options.maxElementsPerPage < 1 || options.maxElementsPerPage > 25)) {
			throw new RangeError('maxElementsPerPage must be between 1 and 25');
		}
		this.maxElementsPerPage = options.maxElementsPerPage ?? 25;
	}

	private isAsserted(): this is SelectMenuPaginator<Data, true> {
		return this.state != null;
	}

	private makeConsumers(): SelectMenuPaginatorConsumers {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		return {
			asButtons: () => {
				if (!this.isAsserted()) {
					throw new Error('State not asserted');
				}

				return {
					...this.state,
					selectMenu: new SelectMenuBuilder(),
					pageLeftButton: new ButtonBuilder()
						.setStyle(ButtonStyle.Secondary)
						.setEmoji({ name: '▶️' })
						.setDisabled(true),
					pageRightButton: new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji({ name: '⬅️' }),
				};
			},
			asSelectMenu: () => {
				if (!this.isAsserted()) {
					throw new Error('State not asserted');
				}

				return {
					...this.state,
					selectMenu: new SelectMenuBuilder(),
				};
			},
		};
	}

	// eslint-disable-next-line @typescript-eslint/prefer-return-this-type
	public assertState(): SelectMenuPaginator<Data, true> {
		if (this.isAsserted()) {
			this.store?.set(this.key, this.state);
			return this;
		}

		if (!this.store) {
			throw new Error('Either store or data are required');
		}

		const state = this.store.get(this.key);
		if (!state) {
			throw new Error('Could not find state');
		}

		const newThis = this as SelectMenuPaginator<Data, true>;
		newThis.state = state;
		return newThis;
	}

	public nextPage(): SelectMenuPaginatorConsumers {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (this.state.currentPage + 1 === this.state.data.length) {
			throw new Error('No next page');
		}

		this.state.currentPage++;
		this.store?.set(this.key, this.state);

		return this.makeConsumers();
	}

	public previousPage(): SelectMenuPaginatorConsumers {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (this.state.currentPage === 0) {
			throw new Error('No previous page');
		}

		this.state.currentPage--;
		this.store?.set(this.key, this.state);

		return this.makeConsumers();
	}

	public setPage(page: number): SelectMenuPaginatorConsumers {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (page < 0 || page >= this.state.data.length) {
			throw new Error('Page is out of bounds');
		}

		this.state.currentPage = page;
		this.store?.set(this.key, this.state);

		return this.makeConsumers();
	}

	public getData(): SelectMenuPaginatorConsumers {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		return this.makeConsumers();
	}

	public destroy(): void {
		const newThis = this as SelectMenuPaginator<Data, false>;
		newThis.state = null;
		this.store?.delete(this.key);
	}
}
