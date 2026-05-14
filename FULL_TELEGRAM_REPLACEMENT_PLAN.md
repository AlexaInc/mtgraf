# Full Telegraf Replacement Plan

This document defines the steps required to turn the current GramJS wrapper into a complete Telegraf v4.16.3-compatible replacement without changing existing project code.

## Current status

- [x] Local partial wrapper exists for `Telegraf`, `Telegram`, `Context`, and `Composer`
- [x] Package exports are wired to local `Telegraf` and local compatibility `Input`
- [ ] Full Telegraf class API is not yet implemented
- [ ] Full `Context` API is not yet implemented
- [ ] `Telegram` Bot API adapter is incomplete
- [ ] `Router`, `Scenes`, `session`, `Markup`, and `Format` compatibility are not yet fully bridged
- [ ] Integration tests and project-level compatibility validation are pending

## Goal

Provide a replacement package that can be used as a drop-in Telegraf backend for existing large projects, with minimal or zero changes to the original codebase.

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

## Phase 6 — verification and integration

1. Add a compiler-level compatibility test against Telegraf types
2. Add runtime integration tests using a representative Telegraf bot project
3. Validate that the wrapper can be used as a direct replacement without changing the project code
4. Document unsupported Bot API methods and GramJS-specific limitations

## Immediate next implementation tasks

- [x] Switch exports to local `Context` and `Composer` wrappers
- [ ] Expand `src/telegraf.ts` to mirror Telegraf class flow and update dispatch
- [ ] Expand `src/context.ts` with the full Telegraf update getter surface
- [ ] Expand `src/telegram.ts` to support the wider Bot API method set
- [ ] Create compatibility stubs for unsupported webhook-related behavior
- [ ] Add integration test scaffolding and example project validation
