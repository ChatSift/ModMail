import type { InferRoutePath, InferRouteMethod, InferRouteBody, InferRouteResult } from '@chatsift/rest-utils';
import type * as routes from './routes/index';

type Narrow<T, U> = T extends U ? T : never;
type ConstructorToType<TConstructor> = TConstructor extends new (...args: any[]) => infer T ? T : never;
type RoutesByClassNames = {
	[K in keyof typeof routes]: ConstructorToType<typeof routes[K]>;
};
type RoutesByPaths = {
	[Path in InferRoutePath<RoutesByClassNames[keyof RoutesByClassNames]>]: RoutesByClassNames[keyof RoutesByClassNames];
};

export type ModmailRoutes = {
	[Path in keyof RoutesByPaths]: {
		[Method in InferRouteMethod<RoutesByPaths[Path]>]: Narrow<RoutesByPaths[Path], { info: { method: Method } }>;
	};
};

export type InferModmailRouteBody<
	TPath extends keyof ModmailRoutes,
	TMethod extends keyof ModmailRoutes[TPath],
> = InferRouteBody<ModmailRoutes[TPath][TMethod]>;

export type InferModmailRouteResult<
	TPath extends keyof ModmailRoutes,
	TMethod extends keyof ModmailRoutes[TPath],
> = InferRouteResult<ModmailRoutes[TPath][TMethod]>;

export * from './util/models';
