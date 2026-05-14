# mtgraf

`mtgraf` is a Telegraf-compatible wrapper for GramJS.

It provides a familiar bot API surface while using MTProto under the hood.

## Install

```bash
npm install mtgraf
```

## Basic usage

```ts
import { Telegraf, Context, Markup } from 'mtgraf';

const bot = new Telegraf('<token>');

bot.start((ctx: Context) => {
  return ctx.reply('Hello from mtgraf!');
});

bot.launch();
```

## Common exports

- `Telegraf`
- `Telegram`
- `Context`
- `Composer`
- `Markup`
- `Format`
- `Input`
- `Scenes`
- `session`
- `filters`
- `Router`

## Purpose

This library is intended for users who want a Telegraf-like developer experience with GramJS and MTProto.

It is not a generic npm publish guide, and publishing details are intentionally omitted.
