# Full Telegraf Replacement Plan

This document defines the steps required to turn the current GramJS wrapper into a complete Telegraf v4.16.3-compatible replacement without changing existing project code.

## Current status

- [x] Local partial wrapper exists for `Telegraf`, `Telegram`, `Context`, and `Composer`
- [x] Package exports are wired to local `Telegraf` and local compatibility `Input`
- [x] Broad Telegraf class API is implemented for common runtime flows
- [x] Broad `Context` API is implemented for common message/media/chat flows
- [x] `Telegram` MTProto adapter covers common send/edit/delete/chat/media operations
- [x] `Router`, `Scenes`, `session`, `Markup`, `Format`, `Input`, `Types`, and `filters` compatibility shims are exported
- [x] MTProto-backed local file IDs are implemented for media received through this wrapper
- [x] Automatic input file resolver handles local MTProto IDs, cached aliases, Buffer, local path, URL, GramJS media, and `{ source, filename }`
- [x] `Input.file(stream, filename)` is normalized to a GramJS `CustomFile`
- [x] Persistent MTProto file reference storage is implemented as a best-effort JSON store
- [x] `session()` supports custom property, async session keys, `defaultSession`, TTL memory store, and `isSessionContext`
- [ ] Integration tests and project-level compatibility validation are pending

## Goal

Provide a replacement package that can be used as a drop-in Telegraf backend for existing large projects, with minimal or zero changes to the original codebase.

## File ID policy

- Media received through GramJS is exposed as Telegraf-style objects with `file_id` values beginning with `mtgraf_`.
- Those local IDs support send/reuse/download through MTProto for photos, documents, videos, audio, voices, animations, stickers, video notes, and media groups while the process still has the media reference in memory.
- Configure `fileStorePath`, `localFileStorePath`, or `MTGRAF_FILE_STORE` to attempt reuse of `mtgraf_...` references after restart.
- `telegram.downloadFile(fileId)` works for local `mtgraf_...` IDs without calling `api.telegram.org`.
- `telegram.getFileLink(fileId)` cannot produce an HTTP URL for local MTProto IDs; use `downloadFile()`.
- Old opaque Bot API `file_id`s are not reliably usable with pure MTProto. Telegram does not expose a stable official decoder from Bot API `file_id` to MTProto `id/accessHash/fileReference`.
- HTTP Bot API fallback is disabled by default. It can be enabled only with `allowBotApiFallback: true` or `botApiMode: 'local-bot-api'`, which should point `apiRoot` to a reachable local/self-hosted Bot API server on blocked hosts.

## Phase 1 — API mapping and package surface

1. Audit installed Telegraf exports and type surface
   - `Telegraf`, `Context`, `Composer`, `Middleware`, `Router`, `TelegramError`, `Telegram`
   - `Types`, `Markup`, `Format`, `Input`, `Scenes`, `session`, `MemorySessionStore`, `SessionStore`
2. Replace package entrypoint exports with local wrapper implementations where possible
3. Build local `Composer` and `Context` to mirror Telegraf method names and typed accessors
4. Add compatibility shims for `Markup`, `Format`, and `Input` exports
5. Ensure `src/index.ts` exports the same API shape as `telegraf` without requiring users to modify imports

## Phase 2 — `Telegraf` core wrapper

1. Implement the Telegraf constructor and options surface
2. Implement `launch()`, `stop()`, `webhookCallback()`, and `createWebhook()` behavior
   - For GramJS, webhook paths can be treated as unsupported stubs or custom handlers if necessary
3. Implement `handleUpdate()` and update dispatch using our local `Context`
4. Implement error handling and `catch()` exactly like Telegraf
5. Add long polling / event loop support via GramJS `TelegramClient` event handlers
6. Provide update type conversion for:
   - `message`
   - `edited_message`
   - `channel_post`
   - `edited_channel_post`
   - `callback_query`
   - `inline_query`
   - `chosen_inline_result`
   - `shipping_query`
   - `pre_checkout_query`
   - `poll`
   - `poll_answer`
   - `my_chat_member`
   - `chat_member`
   - `chat_join_request`
   - `message_reaction` / `message_reaction_count`

## Phase 3 — Context and middleware

1. Build full `Context` getters for all Telegraf update fields
2. Add message helpers: `reply`, `replyWithMarkdown`, `replyWithHTML`, etc.
3. Add convenience methods from Telegraf `Context` and compatibility wrappers
4. Implement local middleware matching for `on`, `hears`, `command`, `action`, `help`, and `use`
5. Add `NarrowedContext` and typed `has()` support

## Phase 4 — `Telegram` adapter

1. Implement `Telegram` adapter with `TelegramClient` backend
2. Add method coverage for all common Bot API operations:
   - `sendMessage`, `sendPhoto`, `sendDocument`, `sendVideo`, `sendAudio`, `sendVoice`, `sendAnimation`, `sendSticker`
   - `sendMediaGroup`, `sendLocation`, `sendVenue`, `sendContact`, `sendDice`
   - `editMessageText`, `editMessageCaption`, `editMessageReplyMarkup`
   - `deleteMessage`, `forwardMessage`, `copyMessage`
   - `answerCallbackQuery`, `answerInlineQuery`, `answerShippingQuery`, `answerPreCheckoutQuery`
   - `getChat`, `getChatAdministrators`, `getChatMember`
   - `setWebhook`, `deleteWebhook`, `getWebhookInfo` (stub if unsupported)
3. Implement `callApi()` compatibility for Telegraf network client internals
4. Add reply markup conversion for Telegraf keyboard types and GramJS `Api` objects
5. Add helpers for file uploads, media groups, inline query results, and custom reply markups

## Phase 5 — full compatibility layers

1. Bridge `Router` and `Scenes` if required by application imports
2. Bridge `session()`, `MemorySessionStore`, and local session store semantics
3. Re-export `Markup`, `Format`, `Input`, and `Types` so existing imports work
4. Provide compatibility for `Context.tg`, `Context.me`, `Context.msg`, `Context.chat`, and all shorthand accessors
5. Support plugin-style Telegraf extensions via identical exports and type signatures
6. Add durable storage for local MTProto file references if file IDs must survive restarts

## Phase 6 — verification and integration

1. Add a compiler-level compatibility test against Telegraf types
2. Add runtime integration tests using a representative Telegraf bot project
3. Validate that the wrapper can be used as a direct replacement without changing the project code
4. Document unsupported Bot API methods and GramJS-specific limitations

## Immediate next implementation tasks

- [x] Switch exports to local `Context` and `Composer` wrappers
- [x] Expand `src/telegraf.ts` to mirror Telegraf class flow and update dispatch for common GramJS events
- [x] Expand `src/context.ts` with the common Telegraf update getter surface
- [x] Expand `src/telegram.ts` to support the wider Bot API method set where MTProto can cover it
- [x] Create compatibility stubs/custom handlers for webhook-related behavior
- [x] Add persistent local MTProto file ID storage
- [ ] Add integration test scaffolding and example project validation
