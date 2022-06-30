import { ButtonBuilder, SelectMenuBuilder } from '@discordjs/builders';
import { ButtonStyle, If, SelectMenuOptionBuilder } from 'discord.js';

export interface SelectMenuPaginatorOptions<T = unknown> {
	key: string;
	data?: T;
	store?: Map<string, SelectMenuPaginatorState<T>>;
	maxPageLength?: number;
}

export interface SelectMenuPaginatorState<T> {
	currentPage: number;
	readonly data: T;
}

interface BaseSelectMenuPaginatorData<T = unknown> extends SelectMenuPaginatorState<T> {
	selectMenu: SelectMenuBuilder;
}

interface SelectMenuOptionsSelectMenuPaginatorData<T = unknown> extends BaseSelectMenuPaginatorData<T> {
	pageLeftOption?: SelectMenuOptionBuilder;
	pageRightOption?: SelectMenuOptionBuilder;
}

interface ButtonsSelectMenuPaginatorData<T = unknown> extends BaseSelectMenuPaginatorData<T> {
	pageLeftButton: ButtonBuilder;
	pageRightButton: ButtonBuilder;
}

export interface SelectMenuPaginatorConsumers<T = unknown> {
	asSelectMenu: () => SelectMenuOptionsSelectMenuPaginatorData<T>;
	asButtons: () => ButtonsSelectMenuPaginatorData<T>;
}

export class SelectMenuPaginator<Data extends unknown[], Asserted extends boolean = false> {
	private readonly key: string;
	private state!: If<Asserted, SelectMenuPaginatorState<Data>>;
	private readonly store?: Map<string, SelectMenuPaginatorState<Data>>;
	private readonly maxPageLength: number;

	public constructor(options: SelectMenuPaginatorOptions<Data> & { data?: Data }) {
		if (options.data) {
			(this as SelectMenuPaginator<Data, true>).state = { currentPage: 0, data: options.data };
		} else {
			(this as SelectMenuPaginator<Data>).state = null;
		}
		this.key = options.key;
		this.store = options.store;
		this.maxPageLength = options.maxPageLength ?? 25;
	}

	private isAsserted(): this is SelectMenuPaginator<Data, true> {
		return this.state != null;
	}

	private makeConsumers(): SelectMenuPaginatorConsumers<Data> {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		return {
			asButtons: () => {
				if (!this.isAsserted()) {
					throw new Error('State not asserted');
				}

				const { currentPage, data } = this.state;
				const slice = data.slice(
					currentPage * this.maxPageLength,
					currentPage * this.maxPageLength + this.maxPageLength,
				) as Data;

				return {
					currentPage,
					data: slice,
					selectMenu: new SelectMenuBuilder().setCustomId('select-menu').setMaxValues(slice.length),
					pageLeftButton: new ButtonBuilder()
						.setCustomId('page-left')
						.setStyle(ButtonStyle.Secondary)
						.setEmoji({ name: '◀️' })
						.setDisabled(currentPage === 0),
					pageRightButton: new ButtonBuilder()
						.setCustomId('page-right')
						.setStyle(ButtonStyle.Secondary)
						.setEmoji({ name: '▶️' })
						.setDisabled(currentPage === this.pageCount - 1),
				};
			},
			asSelectMenu: () => {
				if (!this.isAsserted()) {
					throw new Error('State not asserted');
				}

				const { currentPage, data } = this.state;
				let offset = 0;
				if (currentPage === 0) {
					offset++;
				}

				if (currentPage === this.pageCount - 1) {
					offset++;
				}

				const maxPageLength = this.maxPageLength - offset;
				const slice = data.slice(currentPage * maxPageLength, currentPage * maxPageLength + maxPageLength) as Data;

				return {
					currentPage,
					data: slice,
					pageLeftOption:
						currentPage === 0 && this.pageCount > 1
							? new SelectMenuOptionBuilder().setEmoji({ name: '◀️' }).setLabel('Page left').setValue('page-left')
							: undefined,
					pageRightOption:
						currentPage === this.pageCount - 1 && this.pageCount > 1
							? new SelectMenuOptionBuilder().setEmoji({ name: '▶️' }).setLabel('Page right').setValue('page-right')
							: undefined,
					selectMenu: new SelectMenuBuilder().setCustomId('select-menu').setMinValues(1).setMaxValues(slice.length),
				};
			},
		};
	}

	public get pageCount(): number {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		return Math.ceil(this.state.data.length / this.maxPageLength);
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

	public nextPage(): SelectMenuPaginatorConsumers<Data> {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (this.state.currentPage + 1 === this.pageCount) {
			throw new Error('No next page');
		}

		this.state.currentPage++;
		this.store?.set(this.key, this.state);

		return this.makeConsumers();
	}

	public previousPage(): SelectMenuPaginatorConsumers<Data> {
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

	public setPage(page: number): SelectMenuPaginatorConsumers<Data> {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (page < 0 || page >= this.pageCount) {
			throw new Error('Page is out of bounds');
		}

		this.state.currentPage = page;
		this.store?.set(this.key, this.state);

		return this.makeConsumers();
	}

	public getCurrentPage(): SelectMenuPaginatorConsumers<Data> {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		return this.makeConsumers();
	}

	public destroy(): void {
		const newThis = this as SelectMenuPaginator<Data>;
		newThis.state = null;
		this.store?.delete(this.key);
	}
}
