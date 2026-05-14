// Author: AlexaInc
// Package: mtgraf
// Copyright (c) 2026 AlexaInc

import type { Middleware } from './composer';

export class Router<C = any> {
  private readonly routeFn: (ctx: C) => string | number | symbol | Promise<string | number | symbol>;
  private readonly handlers: Record<string | number | symbol, Middleware<C>>;

  constructor(routeFn: (ctx: C) => string | number | symbol | Promise<string | number | symbol>, handlers: Record<string | number | symbol, Middleware<C>>) {
    this.routeFn = routeFn;
    this.handlers = handlers;
  }

  middleware(): Middleware<C> {
    return async (ctx, next) => {
      const route = await this.routeFn(ctx);
      const handler = this.handlers[route];
      return handler ? handler(ctx, next) : next();
    };
  }
}
