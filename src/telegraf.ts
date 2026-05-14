// Author: AlexaInc
// Package: mtgraf
// Copyright (c) 2026 AlexaInc

import { Composer } from './composer';
import { Context } from './context';
import { Api } from 'telegram';
import { NewMessage } from 'telegram/events';
import { EditedMessage } from 'telegram/events/EditedMessage';
import { CallbackQuery } from 'telegram/events/CallbackQuery';
import { registerLocalFile, Telegram } from './telegram';

export interface TelegrafOptions {
  apiId?: number;
  apiHash?: string;
  session?: string;
  connectionRetries?: number;
  allowBotApiFallback?: boolean;
  botApiMode?: 'mtproto' | 'local-bot-api';
  fileStorePath?: string;
  localFileStorePath?: string;
  telegram?: Record<string, any>;
}

export interface LaunchOptions {
  dropPendingUpdates?: boolean;
}

function getEnvNumber(key: string): number | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function getEnvString(key: string): string | undefined {
  const value = process.env[key];
  return value?.trim() ? value : undefined;
}

type GramJsUpdate = Record<string, unknown>;

function convertPeerId(peer: any) {
  return peer?.userId ?? peer?.chatId ?? peer?.channelId ?? peer;
}

function convertUser(fromId: any) {
  if (!fromId) return undefined;
  const id = convertPeerId(fromId);
  return { id, is_bot: false, first_name: '', last_name: '' };
}

function convertChat(peer: any) {
  if (!peer) return undefined;
  const chatId = convertPeerId(peer);
  const type = peer?.userId ? 'private' : peer?.chatId ? 'group' : peer?.channelId ? 'channel' : undefined;
  return { id: chatId, type };
}

function toNumber(value: any) {
  return value?.toJSNumber?.() ?? value;
}

function getAttribute(document: any, className: string) {
  const ctor = (Api as any)[className];
  return document?.attributes?.find?.((attribute: any) =>
    (typeof ctor === 'function' && attribute instanceof ctor) || attribute?.className === className
  );
}

function getFileName(document: any) {
  return getAttribute(document, 'DocumentAttributeFilename')?.fileName;
}

function classifyDocumentMedia(media: any): { kind: 'document' | 'video' | 'audio' | 'voice' | 'animation' | 'sticker' | 'video_note'; field: string; value: Record<string, any> } {
  const document = media.document;
  const fileName = getFileName(document);
  const audio = getAttribute(document, 'DocumentAttributeAudio');
  const video = getAttribute(document, 'DocumentAttributeVideo');
  const sticker = getAttribute(document, 'DocumentAttributeSticker');
  const animated = getAttribute(document, 'DocumentAttributeAnimated');
  const size = toNumber(document?.size);
  const base = {
    mime_type: document?.mimeType,
    file_name: fileName,
    file_size: size,
  };

  if (sticker) {
    return {
      kind: 'sticker',
      field: 'sticker',
      value: {
        emoji: sticker.alt,
        set_name: sticker.stickerset?.shortName,
        width: video?.w,
        height: video?.h,
        is_animated: Boolean(animated),
        is_video: Boolean(video),
        ...base,
      },
    };
  }

  if (video?.roundMessage) {
    return {
      kind: 'video_note',
      field: 'video_note',
      value: {
        length: video.w,
        duration: video.duration,
        file_size: size,
      },
    };
  }

  if (animated || document?.mimeType === 'image/gif') {
    return {
      kind: 'animation',
      field: 'animation',
      value: {
        width: video?.w,
        height: video?.h,
        duration: video?.duration,
        ...base,
      },
    };
  }

  if (video) {
    return {
      kind: 'video',
      field: 'video',
      value: {
        width: video.w,
        height: video.h,
        duration: video.duration,
        ...base,
      },
    };
  }

  if (audio?.voice) {
    return {
      kind: 'voice',
      field: 'voice',
      value: {
        duration: audio.duration,
        mime_type: document?.mimeType,
        file_size: size,
      },
    };
  }

  if (audio) {
    return {
      kind: 'audio',
      field: 'audio',
      value: {
        duration: audio.duration,
        performer: audio.performer,
        title: audio.title,
        ...base,
      },
    };
  }

  return {
    kind: 'document',
    field: 'document',
    value: base,
  };
}

function convertMessage(message: any) {
  if (!message) return undefined;

  const result: any = {
    message_id: message.id,
    date: message.date,
    chat: convertChat(message.peerId),
    from: convertUser(message.fromId),
    text: message.message,
    entities: message.entities,
    caption: message.caption,
    caption_entities: message.captionEntities,
    reply_markup: message.replyMarkup,
  };

  if (message.media) {
    const media = message.media;
    if (media.photo) {
      const ref = registerLocalFile('photo', media);
      result.photo = [{
        file_id: ref.id,
        file_unique_id: ref.uniqueId,
        file_size: ref.size,
      }];
      result._mtgraf_media = media;
    }
    if (media.document) {
      const documentMedia = classifyDocumentMedia(media);
      const ref = registerLocalFile(documentMedia.kind, media, toNumber(media.document.size));
      result[documentMedia.field] = {
        file_id: ref.id,
        file_unique_id: ref.uniqueId,
        ...documentMedia.value,
      };
      result._mtgraf_media = media;
    }
    if (media.video) {
      const ref = registerLocalFile('video', media);
      result.video = {
        file_id: ref.id,
        file_unique_id: ref.uniqueId,
        file_size: media.video.size?.toJSNumber?.() ?? media.video.size,
      };
      result._mtgraf_media = media;
    }
    if (media.audio) {
      const ref = registerLocalFile('audio', media);
      result.audio = {
        file_id: ref.id,
        file_unique_id: ref.uniqueId,
        file_size: media.audio.size?.toJSNumber?.() ?? media.audio.size,
      };
      result._mtgraf_media = media;
    }
    if (media.voice) {
      const ref = registerLocalFile('voice', media);
      result.voice = {
        file_id: ref.id,
        file_unique_id: ref.uniqueId,
        file_size: media.voice.size?.toJSNumber?.() ?? media.voice.size,
      };
      result._mtgraf_media = media;
    }
    if (media.animation) {
      const ref = registerLocalFile('animation', media);
      result.animation = {
        file_id: ref.id,
        file_unique_id: ref.uniqueId,
        file_size: media.animation.size?.toJSNumber?.() ?? media.animation.size,
      };
      result._mtgraf_media = media;
    }
    if (media.geoPoint) result.location = {
      latitude: media.geoPoint.lat,
      longitude: media.geoPoint.long,
    };
    if (media.venue) {
      result.venue = {
        location: {
          latitude: media.venue.geoPoint.lat,
          longitude: media.venue.geoPoint.long,
        },
        title: media.venue.title,
        address: media.venue.address,
        foursquare_id: media.venue.providerId,
        foursquare_type: media.venue.providerType,
      };
    }
    if (media.contact) {
      result.contact = {
        phone_number: media.contact.phoneNumber,
        first_name: media.contact.firstName,
        last_name: media.contact.lastName,
        vcard: media.contact.vcard,
      };
    }
    if (media.dice) {
      result.dice = {
        emoji: media.dice.emoji,
        value: media.dice.value,
      };
    }
  }

  if (message.replyTo) {
    result.reply_to_message = {
      message_id: message.replyTo.replyToMsgId,
    };
  }

  return result;
}

function convertCallbackQuery(event: any, message: any) {
  if (!event) return undefined;
  const query = event.query ?? event;
  const from = convertUser(event.senderId ?? event.fromId ?? query.senderId ?? query.fromId);

  return {
    id: query.queryId?.toString?.() ?? query.id?.toString?.(),
    from,
    data: query.data?.toString?.(),
    chat_instance: query.chatInstance?.toString?.(),
    message: convertMessage(message),
    inline_message_id: undefined,
    game_short_name: undefined,
  };
}

export class Telegraf<C extends Context = Context> extends Composer<C> {
  public telegram: Telegram;
  public botInfo: unknown;
  public context: Partial<C> = {};
  private running = false;
  private readonly token: string;

  constructor(token: string, options: TelegrafOptions = {}) {
    super();
    if (!token) {
      throw new Error('Telegraf token is required');
    }

    this.token = token;
    this.telegram = new Telegram(token, { ...options.telegram, ...options });
  }

  private handleError: (err: unknown, ctx: C) => Promise<void> | void = async (err: unknown, ctx: C) => {
    console.error('Unhandled error while processing update', err, ctx);
    throw err;
  };

  catch(handler: (err: unknown, ctx: C) => Promise<void> | void) {
    this.handleError = handler;
    return this;
  }

  async launch(config: LaunchOptions | (() => void) = {}, onLaunch?: () => void) {
    const [cfg, onMe] = typeof config === 'function' ? [{}, config] : [config, onLaunch];

    if (cfg && (cfg as any).webhook) {
      throw new Error('Webhooks are not supported with the GramJS Telegraf backend');
    }

    await this.telegram.connect();
    this.botInfo ??= await this.telegram.getMe();
    onMe?.();

    this.registerEventHandlers();
    this.running = true;

    if (cfg.dropPendingUpdates) {
      // GramJS does not expose a direct drop-pending-updates API; new session semantics are used instead.
    }

    return this;
  }

  async stop() {
    if (!this.running) {
      return this;
    }

    await this.telegram.disconnect();
    this.running = false;
    return this;
  }

  get webhookReply() {
    return (this.telegram as any).webhookReply;
  }

  set webhookReply(enable: boolean) {
    (this.telegram as any).webhookReply = enable;
  }

  webhookCallback(path = '/', opts: { secretToken?: string } = {}) {
    return async (req: any, res: any, next?: () => void) => {
      if (req.url && path !== '/' && !req.url.startsWith(path)) {
        next?.();
        return;
      }

      if (opts.secretToken && req.headers?.['x-telegram-bot-api-secret-token'] !== opts.secretToken) {
        res.statusCode = 403;
        res.end?.();
        return;
      }

      const update = req.body;
      if (!update) {
        res.statusCode = 400;
        res.end?.();
        return;
      }

      await this.handleUpdate(update as any);
      res.statusCode = 200;
      res.end?.('OK');
    };
  }

  async createWebhook(opts: { domain: string; path?: string; secretToken?: string } & Record<string, any>) {
    await this.telegram.setWebhook(`${opts.domain}${opts.path ?? '/'}`, opts as any);
    return this.webhookCallback(opts.path ?? '/', { secretToken: opts.secretToken });
  }

  private registerEventHandlers() {
    this.telegram.client.addEventHandler(this.handleNewMessage.bind(this), new NewMessage({}));
    this.telegram.client.addEventHandler(this.handleEditedMessage.bind(this), new EditedMessage({}));
    this.telegram.client.addEventHandler(this.handleCallbackQuery.bind(this), new CallbackQuery());
  }

  private async handleNewMessage(event: any) {
    const update: GramJsUpdate = { message: convertMessage(event.message) };
    await this.dispatch(update);
  }

  private async handleEditedMessage(event: any) {
    const update: GramJsUpdate = { edited_message: convertMessage(event.message) };
    await this.dispatch(update);
  }

  private async handleCallbackQuery(event: any) {
    const message = event.message ?? (typeof event.getMessage === 'function' ? await event.getMessage().catch(() => undefined) : undefined);
    const callbackQuery = convertCallbackQuery(event, message);
    if (!callbackQuery) return;
    await this.dispatch({ callback_query: callbackQuery });
  }

  async handleUpdate(update: GramJsUpdate) {
    await this.dispatch(update);
  }

  private async dispatch(update: GramJsUpdate) {
    if (!update) {
      return;
    }

    const ctx = new Context(update as any, this.telegram as any, this.botInfo as any) as C;
    Object.assign(ctx, this.context);
    const middleware = this.middleware();
    try {
      await middleware(ctx, async () => Promise.resolve());
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }
}
