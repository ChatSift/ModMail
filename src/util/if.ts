export type If<Condition extends boolean, Then, Else> = Condition extends true ? Then : Else;
