type MemoizableFunction = (arg: any) => unknown;

const CACHE = new WeakMap<MemoizableFunction, Map<any, unknown>>();

export function memoize<T extends (arg: any) => unknown>(fn: T, ttl: number): T {
	return ((arg) => {
		let memoized = CACHE.get(fn);
		if (!memoized) {
			memoized = new Map();
			CACHE.set(fn, memoized);
		}

		if (memoized.has(arg)) {
			return memoized.get(arg)!;
		}

		const res = fn(arg);
		memoized.set(arg, res);
		setTimeout(() => memoized!.delete(arg), ttl).unref();

		return res;
	}) as T;
}
