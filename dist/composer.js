export function compose(middlewares) {
    return async function composed(ctx, next) {
        let index = -1;
        async function dispatch(i) {
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
export function isRegExp(value) {
    return Object.prototype.toString.call(value) === '[object RegExp]';
}
export function textMatch(text, triggers) {
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
        }
        else if (typeof trigger === 'string') {
            if (text.includes(trigger)) {
                return [trigger];
            }
        }
    }
    return null;
}
export class Composer {
    constructor() {
        this.middlewares = [];
    }
    use(...middlewares) {
        this.middlewares.push(...middlewares);
        return this;
    }
    middleware() {
        return compose(this.middlewares);
    }
    on(type, ...middlewares) {
        return this.use(async (ctx, next) => {
            const updateType = ctx.updateType;
            if (isRegExp(type)) {
                if (type.test(updateType)) {
                    await compose(middlewares)(ctx, next);
                    return;
                }
            }
            else {
                if (matchUpdateType(type, ctx)) {
                    await compose(middlewares)(ctx, next);
                    return;
                }
            }
            await next();
        });
    }
    hears(triggers, ...middlewares) {
        return this.use(async (ctx, next) => {
            const text = getMessageText(ctx);
            const match = textMatch(text, triggers);
            if (match) {
                ctx.match = match;
                await compose(middlewares)(ctx, next);
                return;
            }
            await next();
        });
    }
    command(command, ...middlewares) {
        const commands = Array.isArray(command) ? command : [command];
        return this.use(async (ctx, next) => {
            const text = getMessageText(ctx);
            if (!text) {
                await next();
                return;
            }
            const commandPattern = new RegExp(`^/(?:${commands.map((cmd) => escapeRegExp(cmd)).join('|')})(?:@\w+)?(?:\s|$)`, 'i');
            const match = commandPattern.exec(text);
            if (match) {
                ctx.match = match;
                await compose(middlewares)(ctx, next);
                return;
            }
            await next();
        });
    }
    action(triggers, ...middlewares) {
        return this.use(async (ctx, next) => {
            const callbackData = ctx.callbackQuery?.data;
            const match = textMatch(callbackData, triggers);
            if (match) {
                ctx.match = match;
                await compose(middlewares)(ctx, next);
                return;
            }
            await next();
        });
    }
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function getMessageText(ctx) {
    return ctx.message?.message ?? ctx.message?.caption ?? ctx.update?.message?.message ?? undefined;
}
function matchUpdateType(type, ctx) {
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
