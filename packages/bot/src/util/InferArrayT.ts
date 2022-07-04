export type InferArrayT<Ts> = Ts extends (infer T)[] ? T : never;
