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
- [x] Removed runtime dependency on Telegraf; `telegraf` remains only as reference/dev inspiration
- [x] Added package export shims for `Markup`, `Format`, `Input`, `Types`, `Scenes`, `session`, `filters`, and `Router`
- [x] Added MTProto-backed local `mtgraf_...` file IDs for media received through GramJS
- [x] Added MTProto send/download reuse for local photos, documents, videos, audio, voices, animations, stickers, video notes, and media groups
- [x] Added central automatic input file resolver for `mtgraf_...`, cached Bot API aliases, Buffer, local path, URL, GramJS media, and Telegraf-style `{ source, filename }`
- [x] Added stream support for Telegraf-style `Input.file(stream, filename)` by buffering into GramJS `CustomFile`
- [x] Added optional persistent local file store via `fileStorePath`, `localFileStorePath`, or `MTGRAF_FILE_STORE`
- [x] Added `botApiMode: 'local-bot-api'` as an explicit local Bot API fallback mode
- [x] Expanded `session()` compatibility with async session keys, default sessions, TTL-backed `MemorySessionStore`, and `isSessionContext`
- [x] Disabled Telegram Bot API HTTP fallback by default; unsupported Bot API-only methods now throw unless explicitly enabled with `allowBotApiFallback`
- [x] Added document-attribute detection so Telegram documents are exposed as Telegraf-style `document`, `video`, `audio`, `voice`, `animation`, `sticker`, or `video_note`
- [x] Verified TypeScript build passes after current wrapper changes

## Current state

- Broad Telegraf compatibility surface exists, but it is not a complete byte-for-byte Telegraf replacement yet
- Local `Context` includes common getters, reply helpers, edit helpers, callback/query helpers, and Telegram method delegation
- `Telegram` adapter supports common message/media/chat methods through GramJS/MTProto
- Unknown Telegram methods are accepted through `callApi()`/proxy, but Bot API-only methods require `allowBotApiFallback` and therefore are not usable on servers where `api.telegram.org` is blocked
- MTProto local file IDs work in memory by default; with a local file store path configured, best-effort restore is attempted after restart
- Telegram may still expire MTProto file references, so persisted `mtgraf_...` IDs can require receiving/sending the media again
- Old opaque Bot API `file_id`s cannot be reliably decoded and reused with pure MTProto

## Next steps

1. Expand `src/telegraf.ts`
   - [x] Implement broad class API surface from Telegraf v4.16.3
   - [ ] Add support for all update types: `edited_message`, `channel_post`, `edited_channel_post`, `inline_query`, `chosen_inline_result`, `shipping_query`, `pre_checkout_query`, `poll`, `poll_answer`, `my_chat_member`, `chat_member`, `chat_join_request`, `message_reaction`
   - [x] Add `webhookCallback()` and `createWebhook()` compatibility stubs or custom handlers
   - [ ] Add long polling or event loop behavior that matches Telegraf semantics

2. Expand `src/context.ts`
   - [x] Add common Telegraf `Context` getters and shorthand accessors
   - [x] Add `ctx.tg`, `ctx.me`, `ctx.msg`, `ctx.msgId`, `ctx.chat`, `ctx.from`
   - [x] Add common reply and action helper methods consistent with Telegraf
   - [x] Add runtime `has()` helper
   - [ ] Add full `NarrowedContext` typings if needed

3. Expand `src/telegram.ts`
   - [x] Implement additional Bot API methods used by Telegraf and apps where MTProto supports them
   - [x] Add `answerInlineQuery`, `answerShippingQuery`, `answerPreCheckoutQuery` method names
   - [ ] Add `getWebhookInfo`, `setWebhook`, `deleteWebhook` support or stubs
   - [x] Improve reply markup conversion for common keyboard and inline markup types
   - [x] Add file upload/media group handling with GramJS
   - [x] Add best-effort persistent MTProto file reference storage for `mtgraf_...` IDs across restarts

4. Bridge compatibility exports
   - [ ] Ensure `src/index.ts` re-exports `Context`, `Composer`, `Telegram`, `Router`, `TelegramError`, `Types`, `Markup`, `Format`, `Input`, `session`, `Scenes`
   - [ ] Keep imports identical to Telegraf so existing project code does not change

5. Verification and finish
   - [ ] Add a compatibility checklist or tests for existing Telegraf-based project imports
   - [ ] Validate `npm run build` after each step once Node/npm are available on PATH
   - [ ] Document unsupported behavior and limitations clearly

## Notes

- The current wrapper can cover common Telegraf bots, especially message/media workflows, without runtime Telegraf.
- It is not complete for every Bot API method when Telegram Bot API HTTP is unavailable.
- Pure MTProto cannot reliably reuse arbitrary old Bot API `file_id`s because those IDs are opaque Bot API tokens, not MTProto input file locations.
