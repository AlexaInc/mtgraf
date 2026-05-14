export type Middleware<Context = any> = (ctx: Context, next: () => Promise<void>) => Promise<any> | any;
export type MiddlewareFn<Context = any> = Middleware<Context>;
export interface MiddlewareObj<Context = any> {
  middleware(): MiddlewareFn<Context>;
}
export type Trigger<Context = any> = string | RegExp | ((value: string, ctx: Context) => RegExpExecArray | null);

export function compose<Context = any>(middlewares: Middleware<Context>[]) {
  return async function composed(ctx: Context, next?: () => Promise<void>) {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;
      const fn = i === middlewares.length ? next : middlewares[i];
      if (!fn) {
        return;
      }
      return fn(ctx, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}

export function isRegExp(value: unknown): value is RegExp {
  return Object.prototype.toString.call(value) === '[object RegExp]';
}

export function textMatch<Context = any>(text: string | undefined, triggers: Trigger<Context> | Array<Trigger<Context>>, ctx?: Context) {
  if (!text) {
    return null;
  }

  const list = Array.isArray(triggers) ? triggers : [triggers];

  for (const trigger of list) {
    if (isRegExp(trigger)) {
      const result = trigger.exec(text);
      if (result) {
        return result;
      }
    } else if (typeof trigger === 'function') {
      const result = trigger(text, ctx as Context);
      if (result) {
        return result;
      }
    } else if (typeof trigger === 'string') {
      if (text.includes(trigger)) {
        return [trigger];
      }
    }
  }

  return null;
}

export class Composer<ContextType = any> {
  protected middlewares: Array<Middleware<ContextType>> = [];

  use(...middlewares: Array<Middleware<ContextType>>) {
    this.middlewares.push(...middlewares);
    return this;
  }

  middleware() {
    return compose(this.middlewares);
  }

  on(type: string | RegExp | ((update: any) => boolean) | Array<string | RegExp | ((update: any) => boolean)>, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(Composer.on(type as any, ...middlewares));
  }

  guard(guardFn: (update: any) => boolean, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(Composer.guard(guardFn, ...middlewares));
  }

  hears(triggers: Trigger<ContextType> | Array<Trigger<ContextType>>, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(Composer.hears(triggers, ...middlewares));
  }

  command(command: Trigger<ContextType> | Array<Trigger<ContextType>>, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(Composer.command(command, ...middlewares));
  }

  start(...middlewares: Array<Middleware<ContextType>>) {
    return this.command('start', ...middlewares);
  }

  help(...middlewares: Array<Middleware<ContextType>>) {
    return this.command('help', ...middlewares);
  }

  settings(...middlewares: Array<Middleware<ContextType>>) {
    return this.command('settings', ...middlewares);
  }

  action(triggers: Trigger<ContextType> | Array<Trigger<ContextType>>, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(Composer.action(triggers, ...middlewares));
  }

  inlineQuery(triggers: Trigger<ContextType> | Array<Trigger<ContextType>>, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(Composer.inlineQuery(triggers, ...middlewares));
  }

  drop(predicate: (ctx: ContextType) => boolean) {
    return this.use(Composer.drop(predicate));
  }

  filter(predicate: (ctx: ContextType) => boolean) {
    return this.drop(predicate);
  }

  static compose = compose;

  static unwrap<Context = any>(handler: Middleware<Context>) {
    return handler;
  }

  static reply(...args: any[]) {
    return (ctx: any) => ctx.reply(...args);
  }

  static catch<Context = any>(errorHandler: (err: unknown, ctx: Context) => void, ...middlewares: Array<Middleware<Context>>) {
    const middleware = compose(middlewares);
    return async (ctx: Context, next: () => Promise<void>) => {
      try {
        await middleware(ctx, next);
      } catch (error) {
        await errorHandler(error, ctx);
      }
    };
  }

  static fork<Context = any>(middleware: Middleware<Context>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      Promise.resolve(middleware(ctx, async () => undefined)).catch((error) => setTimeout(() => { throw error; }, 0));
      await next();
    };
  }

  static tap<Context = any>(middleware: Middleware<Context>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      await middleware(ctx, async () => undefined);
      await next();
    };
  }

  static passThru() {
    return (_ctx: any, next: () => Promise<void>) => next();
  }

  static lazy<Context = any>(factoryFn: (ctx: Context) => Promise<Middleware<Context>> | Middleware<Context>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      const middleware = await factoryFn(ctx);
      return middleware(ctx, next);
    };
  }

  static log(logFn: (s: string) => void = console.log) {
    return async (ctx: any, next: () => Promise<void>) => {
      logFn(JSON.stringify(ctx.update));
      await next();
    };
  }

  static branch<Context = any>(predicate: boolean | ((ctx: Context) => boolean | Promise<boolean>), trueMiddleware: Middleware<Context>, falseMiddleware: Middleware<Context>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      const result = typeof predicate === 'function' ? await predicate(ctx) : predicate;
      return (result ? trueMiddleware : falseMiddleware)(ctx, next);
    };
  }

  static optional<Context = any>(predicate: (ctx: Context) => boolean | Promise<boolean>, ...middlewares: Array<Middleware<Context>>) {
    const middleware = compose(middlewares);
    return Composer.branch(predicate, middleware, Composer.passThru() as Middleware<Context>);
  }

  static drop<Context = any>(predicate: (ctx: Context) => boolean) {
    return async (ctx: Context, next: () => Promise<void>) => {
      if (predicate(ctx)) return;
      await next();
    };
  }

  static filter = Composer.drop;

  static dispatch<Context = any>(routeFn: (ctx: Context) => string | number | symbol | Promise<string | number | symbol>, handlers: Record<string | number | symbol, Middleware<Context>>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      const route = await routeFn(ctx);
      const handler = handlers[route];
      return handler ? handler(ctx, next) : next();
    };
  }

  static guard<Context = any>(guardFn: (update: any) => boolean, ...middlewares: Array<Middleware<Context>>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      if (guardFn((ctx as any).update)) {
        await compose(middlewares)(ctx, next);
        return;
      }
      await next();
    };
  }

  static on<Context = any>(type: string | RegExp | ((update: any) => boolean) | Array<string | RegExp | ((update: any) => boolean)>, ...middlewares: Array<Middleware<Context>>) {
    const filters = Array.isArray(type) ? type : [type];
    return async (ctx: Context, next: () => Promise<void>) => {
      const matched = filters.some((filter) => {
        const updateType = (ctx as any).updateType;
        if (isRegExp(filter)) return filter.test(updateType);
        if (typeof filter === 'function') return filter((ctx as any).update);
        return matchUpdateType(filter, ctx as any);
      });
      if (matched) {
        await compose(middlewares)(ctx, next);
        return;
      }
      await next();
    };
  }

  static mount = Composer.on;

  static hears<Context = any>(triggers: Trigger<Context> | Array<Trigger<Context>>, ...middlewares: Array<Middleware<Context>>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      const text = getMessageText(ctx as any);
      const match = textMatch(text, triggers, ctx);
      if (match) {
        (ctx as any).match = match;
        await compose(middlewares)(ctx, next);
        return;
      }
      await next();
    };
  }

  static command<Context = any>(command: Trigger<Context> | Array<Trigger<Context>>, ...middlewares: Array<Middleware<Context>>) {
    const commands = Array.isArray(command) ? command : [command];
    return async (ctx: Context, next: () => Promise<void>) => {
      const text = getMessageText(ctx as any);
      if (!text) {
        await next();
        return;
      }

      for (const command of commands) {
        const match = typeof command === 'string'
          ? new RegExp(`^/(?:${escapeRegExp(command)})(?:@\\w+)?(?:\\s|$)(.*)`, 'i').exec(text)
          : isRegExp(command)
            ? command.exec(text)
            : command(text, ctx);
        if (match) {
          (ctx as any).match = match;
          (ctx as any).payload = typeof match[1] === 'string' ? match[1].trim() : '';
          (ctx as any).args = (ctx as any).payload ? (ctx as any).payload.split(/\s+/) : [];
          await compose(middlewares)(ctx, next);
          return;
        }
      }

      await next();
    };
  }

  static action<Context = any>(triggers: Trigger<Context> | Array<Trigger<Context>>, ...middlewares: Array<Middleware<Context>>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      const callbackData = (ctx as any).callbackQuery?.data;
      const match = textMatch(callbackData, triggers, ctx);
      if (match) {
        (ctx as any).match = match;
        await compose(middlewares)(ctx, next);
        return;
      }
      await next();
    };
  }

  static inlineQuery<Context = any>(triggers: Trigger<Context> | Array<Trigger<Context>>, ...middlewares: Array<Middleware<Context>>) {
    return async (ctx: Context, next: () => Promise<void>) => {
      const query = (ctx as any).inlineQuery?.query;
      const match = textMatch(query, triggers, ctx);
      if (match) {
        (ctx as any).match = match;
        await compose(middlewares)(ctx, next);
        return;
      }
      await next();
    };
  }

  static acl<Context = any>(userId: number | number[], ...middlewares: Array<Middleware<Context>>) {
    const ids = Array.isArray(userId) ? userId : [userId];
    return Composer.optional((ctx: any) => ids.includes(ctx.from?.id), ...middlewares);
  }

  static chatType<Context = any>(type: string | string[], ...middlewares: Array<Middleware<Context>>) {
    const types = Array.isArray(type) ? type : [type];
    return Composer.optional((ctx: any) => types.includes(ctx.chat?.type), ...middlewares);
  }

  static privateChat<Context = any>(...middlewares: Array<Middleware<Context>>) {
    return Composer.chatType('private', ...middlewares);
  }

  static groupChat<Context = any>(...middlewares: Array<Middleware<Context>>) {
    return Composer.chatType(['group', 'supergroup'], ...middlewares);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMessageText(ctx: any): string | undefined {
  return ctx.text ?? ctx.message?.text ?? ctx.message?.message ?? ctx.message?.caption ?? ctx.update?.message?.text ?? ctx.update?.message?.message ?? undefined;
}

function matchUpdateType(type: string, ctx: any): boolean {
  const normalizedType = type.toLowerCase();

  if (normalizedType === 'text') {
    return Boolean(ctx.text ?? ctx.message?.text ?? ctx.message?.message);
  }

  if (normalizedType === 'message') {
    return Boolean(ctx.message);
  }

  if (normalizedType === 'callback_query') {
    return Boolean(ctx.callbackQuery);
  }

  if (normalizedType === 'inline_query') {
    return Boolean(ctx.inlineQuery);
  }

  return ctx.updateType === normalizedType;
}
