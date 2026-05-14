export type Middleware<Context = any> = (ctx: Context, next: () => Promise<void>) => Promise<any> | any;

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

export function textMatch(text: string | undefined, triggers: string | RegExp | Array<string | RegExp>) {
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

  on(type: string | RegExp, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(async (ctx, next) => {
      const updateType = (ctx as any).updateType;
      if (isRegExp(type)) {
        if (type.test(updateType)) {
          await compose(middlewares)(ctx, next);
          return;
        }
      } else {
        if (matchUpdateType(type, ctx as any)) {
          await compose(middlewares)(ctx, next);
          return;
        }
      }
      await next();
    });
  }

  hears(triggers: string | RegExp | Array<string | RegExp>, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(async (ctx, next) => {
      const text = getMessageText(ctx as any);
      const match = textMatch(text, triggers);
      if (match) {
        (ctx as any).match = match;
        await compose(middlewares)(ctx, next);
        return;
      }
      await next();
    });
  }

  command(command: string | Array<string>, ...middlewares: Array<Middleware<ContextType>>) {
    const commands = Array.isArray(command) ? command : [command];
    return this.use(async (ctx, next) => {
      const text = getMessageText(ctx as any);
      if (!text) {
        await next();
        return;
      }

      const commandPattern = new RegExp(`^/(?:${commands.map((cmd) => escapeRegExp(cmd)).join('|')})(?:@\w+)?(?:\s|$)`, 'i');
      const match = commandPattern.exec(text);
      if (match) {
        (ctx as any).match = match;
        await compose(middlewares)(ctx, next);
        return;
      }

      await next();
    });
  }

  action(triggers: string | RegExp | Array<string | RegExp>, ...middlewares: Array<Middleware<ContextType>>) {
    return this.use(async (ctx, next) => {
      const callbackData = (ctx as any).callbackQuery?.data;
      const match = textMatch(callbackData, triggers);
      if (match) {
        (ctx as any).match = match;
        await compose(middlewares)(ctx, next);
        return;
      }
      await next();
    });
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMessageText(ctx: any): string | undefined {
  return ctx.message?.message ?? ctx.message?.caption ?? ctx.update?.message?.message ?? undefined;
}

function matchUpdateType(type: string, ctx: any): boolean {
  const normalizedType = type.toLowerCase();

  if (normalizedType === 'text') {
    return Boolean(ctx.message?.message);
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
