import type { Middleware } from './composer';

type MaybePromise<T> = T | Promise<T>;

export interface SyncSessionStore<T = any> {
  get(name: string): T | undefined;
  set(name: string, value: T): void;
  delete(name: string): void;
}

export interface AsyncSessionStore<T = any> {
  get(name: string): Promise<T | undefined>;
  set(name: string, value: T): Promise<unknown>;
  delete(name: string): Promise<unknown>;
}

export interface SessionStore<T = any> {
  get(name: string): MaybePromise<T | undefined>;
  set(name: string, value: T): MaybePromise<unknown>;
  delete(name: string): MaybePromise<unknown>;
}

export class MemorySessionStore<T = any> implements SessionStore<T> {
  private readonly store = new Map<string, { session: T; expires?: number }>();

  constructor(private readonly ttl = Infinity) {}

  get(name: string) {
    const entry = this.store.get(name);
    if (!entry) return undefined;
    if (entry.expires !== undefined && entry.expires <= Date.now()) {
      this.store.delete(name);
      return undefined;
    }
    return entry.session;
  }

  set(name: string, value: T) {
    const expires = Number.isFinite(this.ttl) ? Date.now() + this.ttl : undefined;
    this.store.set(name, { session: value, expires });
  }

  delete(name: string) {
    this.store.delete(name);
  }
}

export function session<S = any>(options: {
  property?: string;
  getSessionKey?: (ctx: any) => MaybePromise<string | undefined>;
  store?: SessionStore<S>;
  defaultSession?: (ctx: any) => S;
} = {}): Middleware {
  const property = options.property ?? 'session';
  const store = options.store ?? new MemorySessionStore();
  const getSessionKey = options.getSessionKey ?? ((ctx: any) => {
    const fromId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    return fromId === undefined || chatId === undefined ? undefined : `${fromId}:${chatId}`;
  });
  const defaultSession = options.defaultSession ?? (() => ({} as S));

  return async (ctx: any, next) => {
    const key = await getSessionKey(ctx);
    if (!key) {
      ctx[property] = undefined;
      await next();
      return;
    }

    ctx[property] = await store.get(key) ?? defaultSession(ctx);
    await next();
    if (ctx[property] === null || ctx[property] === undefined) {
      await store.delete(key);
    } else {
      await store.set(key, ctx[property]);
    }
  };
}

export interface SessionContext<S extends object = object> {
  session?: S;
}

export function isSessionContext<S extends object = object>(ctx: any): ctx is SessionContext<S> {
  return ctx && 'session' in ctx;
}
