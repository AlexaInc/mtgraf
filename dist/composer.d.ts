export type Middleware<Context = any> = (ctx: Context, next: () => Promise<void>) => Promise<any> | any;
export declare function compose<Context = any>(middlewares: Middleware<Context>[]): (ctx: Context, next?: () => Promise<void>) => Promise<void>;
export declare function isRegExp(value: unknown): value is RegExp;
export declare function textMatch(text: string | undefined, triggers: string | RegExp | Array<string | RegExp>): string[] | null;
export declare class Composer<ContextType = any> {
    protected middlewares: Array<Middleware<ContextType>>;
    use(...middlewares: Array<Middleware<ContextType>>): this;
    middleware(): (ctx: ContextType, next?: (() => Promise<void>) | undefined) => Promise<void>;
    on(type: string | RegExp, ...middlewares: Array<Middleware<ContextType>>): this;
    hears(triggers: string | RegExp | Array<string | RegExp>, ...middlewares: Array<Middleware<ContextType>>): this;
    command(command: string | Array<string>, ...middlewares: Array<Middleware<ContextType>>): this;
    action(triggers: string | RegExp | Array<string | RegExp>, ...middlewares: Array<Middleware<ContextType>>): this;
}
//# sourceMappingURL=composer.d.ts.map