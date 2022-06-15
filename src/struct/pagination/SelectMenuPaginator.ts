import { ButtonBuilder, SelectMenuBuilder } from '@discordjs/builders';
import type { SelectMenuPaginatorConsumers, SelectMenuPaginatorOptions, SelectMenuPaginatorState } from './common';
import type { ISelectMenuPaginatorStore } from './store/ISelectMenuPaginatorStore';

type If<T extends boolean, A, B = null> = T extends true ? A : T extends false ? B : A | B;

export class SelectMenuPaginator<Data = unknown, Asserted extends boolean = Data extends any[] ? true : false> {
	private readonly key: string;
	private state!: If<Asserted, SelectMenuPaginatorState>;
	private readonly store?: ISelectMenuPaginatorStore;
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
					selectMenu: new SelectMenuBuilder().setCustomId('').toJSON(),
					pageLeftButton: new ButtonBuilder().toJSON(),
					pageRightButton: new ButtonBuilder().toJSON(),
				};
			},
			asSelectMenu: () => {
				if (!this.isAsserted()) {
					throw new Error('State not asserted');
				}

				return {
					...this.state,
					selectMenu: new SelectMenuBuilder().toJSON(),
				};
			},
		};
	}

	public async assertState(): Promise<SelectMenuPaginator<Data, true>> {
		if (this.isAsserted()) {
			return this;
		}

		if (this.store == null) {
			throw new Error('Either store or data are required');
		}

		const state = await this.store.get(this.key);
		if (!state) {
			throw new Error('Could not find state');
		}

		const newThis = this as SelectMenuPaginator<Data, true>;
		newThis.state = state;
		return newThis;
	}

	public async nextPage(): Promise<SelectMenuPaginatorConsumers> {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (this.state.currentPage + 1 === this.state.data.length) {
			throw new Error('No next page');
		}

		this.state.currentPage++;
		if (this.store) {
			await this.store.setPage(this.key, this.state.currentPage);
		}

		return this.makeConsumers();
	}

	public async previousPage(): Promise<SelectMenuPaginatorConsumers> {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (this.state.currentPage === 0) {
			throw new Error('No previous page');
		}

		this.state.currentPage--;
		if (this.store) {
			await this.store.setPage(this.key, this.state.currentPage);
		}

		return this.makeConsumers();
	}

	public async setPage(page: number): Promise<SelectMenuPaginatorConsumers> {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		if (page < 0 || page >= this.state.data.length) {
			throw new Error('Page is out of bounds');
		}

		this.state.currentPage = page;
		if (this.store) {
			await this.store.setPage(this.key, this.state.currentPage);
		}

		return this.makeConsumers();
	}

	public getData(): SelectMenuPaginatorConsumers {
		if (!this.isAsserted()) {
			throw new Error('State not asserted');
		}

		return this.makeConsumers();
	}

	public async destroy(): Promise<void> {
		const newThis = this as SelectMenuPaginator<Data, false>;
		newThis.state = null;
		await this.store?.delete(this.key);
	}
}
