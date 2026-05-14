# Telegraf Replacement Progress

## Completed

- [x] Created local wrapper files:
  - `src/index.ts`
  - `src/telegraf.ts`
  - `src/telegram.ts`
  - `src/context.ts`
  - `src/composer.ts`
  - `src/input.ts`
- [x] Switched exports to local wrapper classes where needed
- [x] Added compatibility `Input` module
- [x] Built local `Composer` middleware helpers: `use`, `on`, `hears`, `command`, `action`
- [x] Implemented partial `Telegraf` wrapper with `launch`, `stop`, event registration, and update dispatch
- [x] Hooked GramJS `NewMessage` and `CallbackQuery` events into update conversion
- [x] Added local `Context` with core reply helpers
- [x] Expanded `Context` to support more Telegraf-style getters and shorthand values (`tg`, `me`, `text`, `msg`, `msgId`, `has`)
- [x] Added `EditedMessage` support in `src/telegraf.ts`
- [x] Added `Telegram` adapter wrapping GramJS `TelegramClient`
- [x] Verified TypeScript build passes after current wrapper changes

## Current state

- Partial Telegraf API implemented, but not full coverage
- Local `Context` exists with basic getters and reply helpers
- `Telegram` adapter supports a small subset of Bot API methods
- Webhook support is stubbed/unsupported for GramJS

## Next steps

1. Expand `src/telegraf.ts`
   - [ ] Implement full class API surface from Telegraf v4.16.3
   - [ ] Add support for all update types: `edited_message`, `channel_post`, `edited_channel_post`, `inline_query`, `chosen_inline_result`, `shipping_query`, `pre_checkout_query`, `poll`, `poll_answer`, `my_chat_member`, `chat_member`, `chat_join_request`, `message_reaction`
   - [ ] Add `webhookCallback()` and `createWebhook()` compatibility stubs or custom handlers
   - [ ] Add long polling or event loop behavior that matches Telegraf semantics

2. Expand `src/context.ts`
   - [ ] Add all Telegraf `Context` getters and shorthand accessors
   - [ ] Add `ctx.tg`, `ctx.me`, `ctx.msg`, `ctx.msgId`, `ctx.chat`, `ctx.from`
   - [ ] Add reply and action helper methods consistent with Telegraf
   - [ ] Add `has()` and `NarrowedContext` typings if needed

3. Expand `src/telegram.ts`
   - [ ] Implement additional Bot API methods used by Telegraf and apps
   - [ ] Add `answerInlineQuery`, `answerShippingQuery`, `answerPreCheckoutQuery`
   - [ ] Add `getWebhookInfo`, `setWebhook`, `deleteWebhook` support or stubs
   - [ ] Improve reply markup conversion for all keyboard and inline markup types
   - [ ] Add file upload/media group handling with GramJS `Api.InputMedia*`

4. Bridge compatibility exports
   - [ ] Ensure `src/index.ts` re-exports `Context`, `Composer`, `Telegram`, `Router`, `TelegramError`, `Types`, `Markup`, `Format`, `Input`, `session`, `Scenes`
   - [ ] Keep imports identical to Telegraf so existing project code does not change

5. Verification and finish
   - [ ] Add a compatibility checklist or tests for existing Telegraf-based project imports
   - [ ] Validate `npm run build` after each step
   - [ ] Document unsupported behavior and limitations clearly

## Notes

- The current wrapper is a starting point, not a complete drop-in replacement yet.
- The next work should focus on exact API coverage, not just minimal functionality.
