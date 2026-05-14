// Author: AlexaInc
// Package: mtgraf
// Copyright (c) 2026 AlexaInc

//This file is part of MTGraf, an MTProto-based Telegram bot framework for Node.js.
//Copyright (c) 2026-present, Alexainc and MTGraf contributors
//



import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { statSync } from 'fs';
import { dirname } from 'path';
import { Readable } from 'stream';

export class TelegramError extends Error {
  response?: unknown;
  on?: { method: string; payload: unknown };

  constructor(message: string, response?: unknown, on?: { method: string; payload: unknown }) {
    super(message);
    this.name = 'TelegramError';
    this.response = response;
    this.on = on;
  }
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

function resolvePeer(peer: any) {
  return peer === undefined || peer === null ? peer : peer;
}

type LocalFileKind = 'photo' | 'document' | 'video' | 'audio' | 'voice' | 'animation' | 'sticker' | 'video_note';
type LocalFileRef = {
  kind: LocalFileKind;
  media: any;
  id: string;
  uniqueId: string;
  size?: number;
  aliases?: string[];
};

const localFiles = new Map<string, LocalFileRef>();
const localFileAliases = new Map<string, string>();
let localFileStorePath: string | undefined;
let localFileStoreLoaded = false;

type PersistedLocalFile = {
  kind: LocalFileKind;
  id: string;
  uniqueId: string;
  size?: number;
  aliases?: string[];
  media?: any;
};

function bigIntLikeToString(value: any) {
  return value?.toString?.() ?? String(value ?? '');
}

function localFileKey(kind: LocalFileKind, media: any) {
  const source = media?.photo ?? media?.document ?? media;
  const id = bigIntLikeToString(source?.id);
  const accessHash = bigIntLikeToString(source?.accessHash);
  return `${kind}:${id}:${accessHash}`;
}

function encodeLocalFileId(kind: LocalFileKind, media: any) {
  const source = media?.photo ?? media?.document ?? media;
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    k: kind,
    id: bigIntLikeToString(source?.id),
    ah: bigIntLikeToString(source?.accessHash),
  })).toString('base64url');

  return `mtgraf_${payload}`;
}

function serializeForStore(value: any, seen = new WeakSet<object>()): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'bigint') return { __mtgrafType: 'bigint', value: value.toString() };
  if (Buffer.isBuffer(value)) return { __mtgrafType: 'buffer', value: value.toString('base64') };
  if (Array.isArray(value)) return value.map((item) => serializeForStore(item, seen));
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);

  const className = value.className ?? value.constructor?.name;
  const data: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'function' || key === 'client') continue;
    const serialized = serializeForStore(entry, seen);
    if (serialized !== undefined) data[key] = serialized;
  }
  return className ? { __mtgrafType: 'api', className, data } : data;
}

function deserializeFromStore(value: any): any {
  if (Array.isArray(value)) return value.map(deserializeFromStore);
  if (!value || typeof value !== 'object') return value;
  if (value.__mtgrafType === 'bigint') return BigInt(value.value);
  if (value.__mtgrafType === 'buffer') return Buffer.from(value.value, 'base64');
  if (value.__mtgrafType === 'api') {
    const data = deserializeFromStore(value.data ?? {});
    const ctor = (Api as any)[value.className];
    return typeof ctor === 'function' ? new ctor(data) : data;
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, deserializeFromStore(entry)]));
}

function persistedLocalFile(ref: LocalFileRef): PersistedLocalFile {
  return {
    kind: ref.kind,
    id: ref.id,
    uniqueId: ref.uniqueId,
    size: ref.size,
    aliases: ref.aliases,
    media: serializeForStore(ref.media),
  };
}

async function loadLocalFileStore() {
  if (localFileStoreLoaded || !localFileStorePath) return;
  localFileStoreLoaded = true;
  const raw = await readFile(localFileStorePath, 'utf8').catch((error: any) => {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  });
  if (!raw) return;

  const parsed = JSON.parse(raw) as PersistedLocalFile[];
  for (const item of parsed) {
    if (!item?.id || !item.media) continue;
    const ref: LocalFileRef = {
      kind: item.kind,
      id: item.id,
      uniqueId: item.uniqueId,
      size: item.size,
      aliases: item.aliases ?? [],
      media: deserializeFromStore(item.media),
    };
    localFiles.set(ref.id, ref);
    for (const alias of ref.aliases ?? []) localFileAliases.set(alias, ref.id);
  }
}

async function persistLocalFileStore() {
  if (!localFileStorePath) return;
  await mkdir(dirname(localFileStorePath), { recursive: true });
  await writeFile(localFileStorePath, JSON.stringify([...localFiles.values()].map(persistedLocalFile), null, 2));
}

export function configureLocalFileStore(path?: string) {
  localFileStorePath = path;
  localFileStoreLoaded = false;
}

export function registerLocalFile(kind: LocalFileKind, media: any, size?: number, aliases: string[] = []) {
  const key = localFileKey(kind, media);
  for (const existing of localFiles.values()) {
    if (existing.uniqueId === key) {
      existing.aliases = [...new Set([...(existing.aliases ?? []), ...aliases.filter(Boolean)])];
      for (const alias of existing.aliases) localFileAliases.set(alias, existing.id);
      void persistLocalFileStore();
      return existing;
    }
  }

  const ref: LocalFileRef = {
    kind,
    media,
    id: encodeLocalFileId(kind, media),
    uniqueId: key,
    size,
    aliases: aliases.filter(Boolean),
  };
  localFiles.set(ref.id, ref);
  for (const alias of ref.aliases ?? []) localFileAliases.set(alias, ref.id);
  void persistLocalFileStore();
  return ref;
}

export function registerLocalFileAlias(fileId: string, localFileId: string) {
  const ref = localFiles.get(localFileId);
  if (!ref) {
    if (isLocalFileId(localFileId)) {
      localFileAliases.set(fileId, localFileId);
      return true;
    }
    return false;
  }
  ref.aliases = [...new Set([...(ref.aliases ?? []), fileId])];
  localFileAliases.set(fileId, ref.id);
  void persistLocalFileStore();
  return true;
}

function resolveLocalFile(value: any): LocalFileRef | undefined {
  if (typeof value === 'string') return localFiles.get(value) ?? localFiles.get(localFileAliases.get(value) ?? '');
  if (value?.file_id) return localFiles.get(value.file_id) ?? localFiles.get(localFileAliases.get(value.file_id) ?? '');
  return undefined;
}

function isLocalFileId(value: unknown) {
  return typeof value === 'string' && value.startsWith('mtgraf_');
}

type ResolvedInputFile = {
  value: any;
  local?: LocalFileRef;
  botApiFileId?: string;
  isRemoteUrl?: boolean;
  isLocalPath?: boolean;
};

function isReadableStream(value: any): value is NodeJS.ReadableStream {
  return value instanceof Readable || (value && typeof value.pipe === 'function' && typeof value.on === 'function');
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function resolveInputFile(method: string, params: Record<string, any>, value: any, field: string): Promise<ResolvedInputFile> {
  await loadLocalFileStore();
  const local = resolveLocalFile(value);
  const source = value?.source ?? value?.url ?? value;
  const id = typeof source === 'string' ? source : value?.file_id;
  if (isLocalFileId(id) && !local) {
    throw new TelegramError(
      'This MTProto file_id is not available in memory anymore. Receive the file again or add persistent MTProto file storage before reusing it after restart.',
      undefined,
      { method, payload: params }
    );
  }

  if (local) return { local, value: local.media };
  if (isLikelyBotApiFileId(id)) {
    return { value: source, botApiFileId: id };
  }
  if (value?.source !== undefined && value?.filename && Buffer.isBuffer(value.source)) {
    return { value: new CustomFile(value.filename, value.source.length, '', value.source) };
  }
  if (value?.source !== undefined && value?.filename && isReadableStream(value.source)) {
    const buffer = await streamToBuffer(value.source);
    return { value: new CustomFile(value.filename, buffer.length, '', buffer) };
  }
  if (value?.source !== undefined && value?.filename && typeof value.source === 'string' && isLikelyLocalPath(value.source)) {
    const size = statSync(value.source).size;
    return { value: new CustomFile(value.filename, size, value.source), isLocalPath: true };
  }
  if (Buffer.isBuffer(source) && (value?.filename || (source as any).name)) {
    return { value: new CustomFile(value.filename ?? (source as any).name, source.length, '', source) };
  }
  if (isReadableStream(source)) {
    const filename = value?.filename ?? (source as any).name ?? 'file';
    const buffer = await streamToBuffer(source);
    return { value: new CustomFile(filename, buffer.length, '', buffer) };
  }
  if (typeof source === 'string') {
    return {
      value: source,
      isRemoteUrl: isRemoteUrl(source),
      isLocalPath: isLikelyLocalPath(source),
    };
  }

  return { value: source ?? value };
}

function botApiFileIdUnsupported(method: string, params: Record<string, any>, fileId: string) {
  return new TelegramError(
    `Bot API file_id cannot be decoded by pure MTProto: ${fileId}. It can only be reused if it was cached by this library or if a reachable local Bot API apiRoot is configured with allowBotApiFallback.`,
    undefined,
    { method, payload: params }
  );
}

function compact(value: any): any {
  if (Array.isArray(value)) {
    return value.map(compact);
  }

  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, compact(entry)])
    );
  }

  return value;
}

function normalizeFmtStringParams(method: string, params: Record<string, any>) {
  const normalized = { ...params };
  const textLikeKey = normalized.text !== undefined ? 'text' : normalized.caption !== undefined ? 'caption' : undefined;
  const textLikeValue = textLikeKey ? normalized[textLikeKey] : undefined;

  if (textLikeKey && textLikeValue && typeof textLikeValue === 'object' && typeof textLikeValue.text === 'string') {
    normalized[textLikeKey] = textLikeValue.text;
    if (Array.isArray(textLikeValue.entities) && textLikeValue.entities.length) {
      normalized[textLikeKey === 'caption' ? 'caption_entities' : 'entities'] ??= textLikeValue.entities;
    }
  }

  return normalized;
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isLikelyLocalPath(value: string) {
  return value.startsWith('.') || value.startsWith('/') || value.startsWith('~') || value.includes('\\') || /\/|\\/.test(value);
}

function isLikelyBotApiFileId(value: unknown) {
  return typeof value === 'string' && value.length > 20 && !isLocalFileId(value) && !isRemoteUrl(value) && !isLikelyLocalPath(value);
}

function isBotApiReusableMedia(value: unknown) {
  return typeof value === 'string' && (isRemoteUrl(value) || isLikelyBotApiFileId(value));
}

function hasBotApiReusableMedia(params: Record<string, any>, keys: string[]) {
  return keys.some((key) => isBotApiReusableMedia(params[key]));
}

function hasBotApiMediaGroup(params: Record<string, any>) {
  return Array.isArray(params.media) && params.media.some((item: any) => isBotApiReusableMedia(item?.media));
}

async function resolveMediaGroup(method: string, params: Record<string, any>) {
  const items = Array.isArray(params.media) ? params.media : [];
  const resolved = [];
  let botApiFileId: string | undefined;

  for (const item of items) {
    const file = await resolveInputFile(method, params, item?.media, 'media');
    botApiFileId ??= file.botApiFileId;
    resolved.push({ ...item, media: file.value });
  }

  return { media: resolved, botApiFileId };
}

const botApiArgumentNames: Record<string, string[]> = {
  banChatMember: ['chat_id', 'user_id', 'until_date', 'extra'],
  unbanChatMember: ['chat_id', 'user_id', 'only_if_banned'],
  restrictChatMember: ['chat_id', 'user_id', 'permissions', 'extra'],
  promoteChatMember: ['chat_id', 'user_id', 'extra'],
  setChatAdministratorCustomTitle: ['chat_id', 'user_id', 'custom_title'],
  setChatPermissions: ['chat_id', 'permissions', 'extra'],
  setChatPhoto: ['chat_id', 'photo'],
  deleteChatPhoto: ['chat_id'],
  setChatTitle: ['chat_id', 'title'],
  setChatDescription: ['chat_id', 'description'],
  exportChatInviteLink: ['chat_id'],
  createChatInviteLink: ['chat_id', 'extra'],
  editChatInviteLink: ['chat_id', 'invite_link', 'extra'],
  revokeChatInviteLink: ['chat_id', 'invite_link'],
  approveChatJoinRequest: ['chat_id', 'user_id'],
  declineChatJoinRequest: ['chat_id', 'user_id'],
  getChatMemberCount: ['chat_id'],
  getChatMembersCount: ['chat_id'],
  getUserProfilePhotos: ['user_id', 'offset', 'limit'],
  getCustomEmojiStickers: ['custom_emoji_ids'],
  answerWebAppQuery: ['web_app_query_id', 'result'],
  createInvoiceLink: ['invoice'],
  forwardMessages: ['chat_id', 'from_chat_id', 'message_ids', 'extra'],
  copyMessages: ['chat_id', 'from_chat_id', 'message_ids', 'extra'],
  sendCopy: ['chat_id', 'message', 'extra'],
  deleteMessages: ['chat_id', 'message_ids'],
  answerCallbackQuery: ['callback_query_id', 'text', 'extra'],
  answerCbQuery: ['callback_query_id', 'text', 'extra'],
  answerGameQuery: ['callback_query_id', 'url'],
  answerInlineQuery: ['inline_query_id', 'results', 'extra'],
  answerShippingQuery: ['shipping_query_id', 'ok', 'shipping_options', 'error_message'],
  answerPreCheckoutQuery: ['pre_checkout_query_id', 'ok', 'error_message'],
  getGameHighScores: ['user_id', 'inline_message_id', 'chat_id', 'message_id'],
  setGameScore: ['user_id', 'score', 'inline_message_id', 'chat_id', 'message_id', 'edit_message', 'force'],
  stopPoll: ['chat_id', 'message_id', 'extra'],
  setPassportDataErrors: ['user_id', 'errors'],
  setChatStickerSet: ['chat_id', 'sticker_set_name'],
  deleteChatStickerSet: ['chat_id'],
  createForumTopic: ['chat_id', 'name', 'extra'],
  editForumTopic: ['chat_id', 'message_thread_id', 'extra'],
  closeForumTopic: ['chat_id', 'message_thread_id'],
  reopenForumTopic: ['chat_id', 'message_thread_id'],
  deleteForumTopic: ['chat_id', 'message_thread_id'],
  unpinAllForumTopicMessages: ['chat_id', 'message_thread_id'],
  editGeneralForumTopic: ['chat_id', 'name'],
  closeGeneralForumTopic: ['chat_id'],
  reopenGeneralForumTopic: ['chat_id'],
  hideGeneralForumTopic: ['chat_id'],
  unhideGeneralForumTopic: ['chat_id'],
  unpinAllGeneralForumTopicMessages: ['chat_id'],
  getStickerSet: ['name'],
  uploadStickerFile: ['user_id', 'sticker', 'sticker_format'],
  createNewStickerSet: ['user_id', 'name', 'title', 'extra'],
  addStickerToSet: ['user_id', 'name', 'extra'],
  setStickerPositionInSet: ['sticker', 'position'],
  setStickerSetThumbnail: ['name', 'user_id', 'thumbnail'],
  setStickerMaskPosition: ['sticker', 'mask_position'],
  setStickerKeywords: ['sticker', 'keywords'],
  setStickerEmojiList: ['sticker', 'emoji_list'],
  deleteStickerSet: ['name'],
  setStickerSetTitle: ['name', 'title'],
  setCustomEmojiStickerSetThumbnail: ['name', 'custom_emoji_id'],
  deleteStickerFromSet: ['sticker'],
  setMyCommands: ['commands', 'extra'],
  deleteMyCommands: ['extra'],
  getMyCommands: ['extra'],
  setMyName: ['name', 'language_code'],
  getMyName: ['language_code'],
  setMyDescription: ['description', 'language_code'],
  getMyDescription: ['language_code'],
  setMyShortDescription: ['short_description', 'language_code'],
  getMyShortDescription: ['language_code'],
  setChatMenuButton: ['chat_id', 'menu_button'],
  getChatMenuButton: ['chat_id'],
  setMyDefaultAdministratorRights: ['rights', 'for_channels'],
  getMyDefaultAdministratorRights: ['for_channels'],
  banChatSenderChat: ['chat_id', 'sender_chat_id', 'extra'],
  unbanChatSenderChat: ['chat_id', 'sender_chat_id'],
  logOut: [],
  close: [],
};

function argsToBotApiParams(method: string, args: any[]) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) && !Buffer.isBuffer(args[0])) {
    return args[0];
  }

  const names = botApiArgumentNames[method];
  if (!names) {
    return { args };
  }

  const params: Record<string, any> = {};
  names.forEach((name, index) => {
    if (name === 'extra') {
      Object.assign(params, args[index]);
    } else {
      params[name] = args[index];
    }
  });
  return params;
}

function convertInlineButton(button: any) {
  if (!button) return undefined;

  if (button.callback_data || button.callbackData) {
    return new Api.KeyboardButtonCallback({
      text: button.text,
      data: Buffer.from(button.callback_data ?? button.callbackData),
    });
  }

  if (button.url) {
    return new Api.KeyboardButtonUrl({
      text: button.text,
      url: button.url,
    });
  }

  if (button.switch_inline_query_current_chat || button.switch_inline_query) {
    return new Api.KeyboardButtonSwitchInline({
      text: button.text,
      query: button.switch_inline_query_current_chat ?? button.switch_inline_query,
      samePeer: Boolean(button.switch_inline_query_current_chat),
    });
  }

  if (button.request_contact || button.requestContact) {
    return new Api.KeyboardButtonRequestPhone({ text: button.text });
  }

  if (button.request_location || button.requestLocation) {
    return new Api.KeyboardButtonRequestGeoLocation({ text: button.text });
  }

  return new Api.KeyboardButton({ text: button.text });
}

function convertReplyButton(button: any) {
  if (!button) return undefined;

  if (button.request_contact || button.requestContact) {
    return new Api.KeyboardButtonRequestPhone({ text: button.text });
  }

  if (button.request_location || button.requestLocation) {
    return new Api.KeyboardButtonRequestGeoLocation({ text: button.text });
  }

  return new Api.KeyboardButton({ text: button.text });
}

function convertReplyMarkup(markup: any) {
  if (!markup) return undefined;

  if (markup.inline_keyboard) {
    return new Api.ReplyInlineMarkup({
      rows: markup.inline_keyboard.map((row: any[]) =>
        new Api.KeyboardButtonRow({
          buttons: row
            .map(convertInlineButton)
            .filter((button): button is Exclude<ReturnType<typeof convertInlineButton>, undefined> => Boolean(button)),
        })
      ),
    });
  }

  if (markup.keyboard) {
    return new Api.ReplyKeyboardMarkup({
      rows: markup.keyboard.map((row: any[]) =>
        new Api.KeyboardButtonRow({
          buttons: row
            .map(convertReplyButton)
            .filter((button): button is Exclude<ReturnType<typeof convertReplyButton>, undefined> => Boolean(button)),
        })
      ),
      resize: markup.resize_keyboard,
      singleUse: markup.one_time_keyboard,
      selective: markup.selective,
      persistent: markup.is_persistent,
      placeholder: markup.input_field_placeholder,
    });
  }

  if (markup.remove_keyboard || markup.removeKeyboard) {
    return markup;
  }

  if (markup.force_reply) {
    return markup;
  }

  return markup;
}

function mapSendOptions(options: Record<string, any>) {
  const mapped: Record<string, any> = { ...options };

  if (options.parse_mode) {
    mapped.parseMode = options.parse_mode;
    delete mapped.parse_mode;
  }
  if (options.text !== undefined) {
    mapped.message = options.text;
    delete mapped.text;
  }
  if (options.disable_web_page_preview !== undefined) {
    mapped.linkPreview = !options.disable_web_page_preview;
    delete mapped.disable_web_page_preview;
  }
  if (options.disable_notification !== undefined) {
    mapped.silent = options.disable_notification;
    delete mapped.disable_notification;
  }
  if (options.reply_to_message_id !== undefined) {
    mapped.replyTo = options.reply_to_message_id;
    delete mapped.reply_to_message_id;
  }
  if (options.reply_markup !== undefined) {
    mapped.buttons = convertReplyMarkup(options.reply_markup);
    delete mapped.reply_markup;
  }
  if (options.caption !== undefined) {
    mapped.message = options.caption;
    delete mapped.caption;
  }
  if (options.entities !== undefined) {
    mapped.formattingEntities = options.entities;
    delete mapped.entities;
  }
  if (options.message_thread_id !== undefined) {
    mapped.topMsgId = options.message_thread_id;
    delete mapped.message_thread_id;
  }
  if (options.allow_sending_without_reply !== undefined) {
    mapped.allowSendingWithoutReply = options.allow_sending_without_reply;
    delete mapped.allow_sending_without_reply;
  }

  return mapped;
}

function mapChatAction(action: string) {
  const normalized = action?.toLowerCase?.();
  switch (normalized) {
    case 'typing':
      return new Api.SendMessageTypingAction();
    case 'upload_photo':
      return new Api.SendMessageUploadPhotoAction({ progress: 0 });
    case 'record_video':
      return new Api.SendMessageRecordVideoAction();
    case 'upload_video':
      return new Api.SendMessageUploadVideoAction({ progress: 0 });
    case 'record_voice':
      return new Api.SendMessageRecordAudioAction();
    case 'upload_voice':
      return new Api.SendMessageUploadAudioAction({ progress: 0 });
    case 'upload_document':
      return new Api.SendMessageUploadDocumentAction({ progress: 0 });
    case 'find_location':
      return new Api.SendMessageGeoLocationAction();
    case 'choose_contact':
      return new Api.SendMessageChooseContactAction();
    case 'choose_sticker':
      return new Api.SendMessageChooseStickerAction();
    default:
      return new Api.SendMessageTypingAction();
  }
}

export class Telegram {
  [method: string]: any;
  public client: TelegramClient;
  private connected = false;
  public webhookReply = false;
  public readonly token: string;
  public readonly options: Record<string, any>;
  public readonly apiRoot: string;
  public readonly allowBotApiFallback: boolean;

  constructor(token: string, options: Record<string, any> = {}) {
    this.token = token;
    this.options = options;
    this.apiRoot = options.apiRoot ?? 'https://api.telegram.org';
    this.allowBotApiFallback = Boolean(options.allowBotApiFallback || options.botApiMode === 'local-bot-api');
    configureLocalFileStore(options.fileStorePath ?? options.localFileStorePath ?? process.env.MTGRAF_FILE_STORE);

    const apiId = options.apiId ?? getEnvNumber('TELEGRAM_API_ID') ?? getEnvNumber('API_ID');
    const apiHash = options.apiHash ?? getEnvString('TELEGRAM_API_HASH') ?? getEnvString('API_HASH');
    if (!apiId || !apiHash) {
      throw new Error('GramJS Telegram requires apiId and apiHash from options or environment variables.');
    }

    const session = new StringSession(options.session ?? process.env.TELEGRAM_SESSION ?? '');
    this.client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: options.connectionRetries ?? 5,
      baseLogger: options.baseLogger,
    });

    return new Proxy(this, {
      get(target, property, receiver) {
        if (typeof property !== 'string' || property in target) {
          return Reflect.get(target, property, receiver);
        }

        if (property === 'then' || property === 'catch' || property === 'finally' || property === 'toJSON' || property === 'inspect') {
          return undefined;
        }

        return (...args: any[]) => target.callApi(property, argsToBotApiParams(property, args));
      },
    });
  }

  async connect() {
    if (this.connected) return this;
    await this.client.start({ botAuthToken: this.token });
    this.connected = true;
    return this;
  }

  async disconnect() {
    if (!this.connected) return this;
    await this.client.disconnect();
    this.connected = false;
  }

  getMe() {
    return this.callApi('getMe');
  }

  getFile(fileId: string) {
    return this.callApi('getFile', { file_id: fileId });
  }

  getFileLink(fileId: string | object) {
    return this.callApi('getFileLink', { file_id: fileId });
  }

  async downloadFile(fileId: string | { file_id?: string; file_path?: string; filePath?: string }, destination?: string) {
    const file = await resolveInputFile('downloadFile', { file_id: fileId }, fileId, 'file_id');
    if (file.local) {
      if (!this.connected) await this.connect();
      return this.client.downloadMedia(file.local.media, { outputFile: destination });
    }
    if (file.botApiFileId && !this.allowBotApiFallback) {
      throw botApiFileIdUnsupported('downloadFile', { file_id: fileId }, file.botApiFileId);
    }

    const link = await this.getFileLink(fileId);
    const response = await fetch(link);
    if (!response.ok) {
      throw new TelegramError(`Failed to download Telegram file: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (destination) {
      await writeFile(destination, buffer);
      return destination;
    }
    return buffer;
  }

  getUpdates(timeout?: number, limit?: number, offset?: number, allowedUpdates?: readonly string[]) {
    return this.callApi('getUpdates', { timeout, limit, offset, allowed_updates: allowedUpdates });
  }

  getWebhookInfo() {
    return this.callApi('getWebhookInfo');
  }

  setWebhook(url: string, extra: Record<string, any> = {}) {
    return this.callApi('setWebhook', { url, ...extra });
  }

  deleteWebhook(extra: Record<string, any> = {}) {
    return this.callApi('deleteWebhook', extra);
  }

  sendMessage(chatId: number | string, text: any, extra: Record<string, any> = {}) {
    return this.callApi('sendMessage', { chat_id: chatId, text, ...extra });
  }

  forwardMessage(chatId: number | string, fromChatId: number | string, messageId: number, extra: Record<string, any> = {}) {
    return this.callApi('forwardMessage', { chat_id: chatId, from_chat_id: fromChatId, message_id: messageId, ...extra });
  }

  copyMessage(chatId: number | string, fromChatId: number | string, messageId: number, extra: Record<string, any> = {}) {
    return this.callApi('copyMessage', { chat_id: chatId, from_chat_id: fromChatId, message_id: messageId, ...extra });
  }

  sendChatAction(chatId: number | string, action: string, extra: Record<string, any> = {}) {
    return this.callApi('sendChatAction', { chat_id: chatId, action, ...extra });
  }

  sendPhoto(chatId: number | string, photo: any, extra: Record<string, any> = {}) {
    return this.callApi('sendPhoto', { chat_id: chatId, photo, ...extra });
  }

  sendDocument(chatId: number | string, document: any, extra: Record<string, any> = {}) {
    return this.callApi('sendDocument', { chat_id: chatId, document, ...extra });
  }

  sendVideo(chatId: number | string, video: any, extra: Record<string, any> = {}) {
    return this.callApi('sendVideo', { chat_id: chatId, video, ...extra });
  }

  sendAudio(chatId: number | string, audio: any, extra: Record<string, any> = {}) {
    return this.callApi('sendAudio', { chat_id: chatId, audio, ...extra });
  }

  sendVoice(chatId: number | string, voice: any, extra: Record<string, any> = {}) {
    return this.callApi('sendVoice', { chat_id: chatId, voice, ...extra });
  }

  sendAnimation(chatId: number | string, animation: any, extra: Record<string, any> = {}) {
    return this.callApi('sendAnimation', { chat_id: chatId, animation, ...extra });
  }

  sendSticker(chatId: number | string, sticker: any, extra: Record<string, any> = {}) {
    return this.callApi('sendSticker', { chat_id: chatId, sticker, ...extra });
  }

  sendVideoNote(chatId: number | string, videoNote: any, extra: Record<string, any> = {}) {
    return this.callApi('sendVideoNote', { chat_id: chatId, video_note: videoNote, ...extra });
  }

  sendMediaGroup(chatId: number | string, media: any[], extra: Record<string, any> = {}) {
    return this.callApi('sendMediaGroup', { chat_id: chatId, media, ...extra });
  }

  sendLocation(chatId: number | string, latitude: number, longitude: number, extra: Record<string, any> = {}) {
    return this.callApi('sendLocation', { chat_id: chatId, latitude, longitude, ...extra });
  }

  sendVenue(chatId: number | string, latitude: number, longitude: number, title: string, address: string, extra: Record<string, any> = {}) {
    return this.callApi('sendVenue', { chat_id: chatId, latitude, longitude, title, address, ...extra });
  }

  sendContact(chatId: number | string, phoneNumber: string, firstName: string, extra: Record<string, any> = {}) {
    return this.callApi('sendContact', { chat_id: chatId, phone_number: phoneNumber, first_name: firstName, ...extra });
  }

  sendDice(chatId: number | string, extra: Record<string, any> = {}) {
    return this.callApi('sendDice', { chat_id: chatId, ...extra });
  }

  sendPoll(chatId: number | string, question: string, options: readonly string[], extra: Record<string, any> = {}) {
    return this.callApi('sendPoll', { chat_id: chatId, question, options, ...extra });
  }

  sendQuiz(chatId: number | string, question: string, options: readonly string[], extra: Record<string, any> = {}) {
    return this.callApi('sendQuiz', { chat_id: chatId, question, options, ...extra });
  }

  sendInvoice(chatId: number | string, invoice: Record<string, any>, extra: Record<string, any> = {}) {
    return this.callApi('sendInvoice', { chat_id: chatId, ...invoice, ...extra });
  }

  sendGame(chatId: number | string, gameName: string, extra: Record<string, any> = {}) {
    return this.callApi('sendGame', { chat_id: chatId, game_short_name: gameName, ...extra });
  }

  answerCbQuery(callbackQueryId: string | undefined, text?: string, extra: Record<string, any> = {}) {
    return this.callApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text, ...extra });
  }

  answerCallbackQuery(callbackQueryId: string | undefined, text?: string, extra: Record<string, any> = {}) {
    return this.answerCbQuery(callbackQueryId, text, extra);
  }

  answerInlineQuery(inlineQueryId: string | undefined, results: readonly any[], extra: Record<string, any> = {}) {
    return this.callApi('answerInlineQuery', { inline_query_id: inlineQueryId, results, ...extra });
  }

  answerShippingQuery(shippingQueryId: string | undefined, ok: boolean, shippingOptions?: readonly any[], errorMessage?: string) {
    return this.callApi('answerShippingQuery', {
      shipping_query_id: shippingQueryId,
      ok,
      shipping_options: shippingOptions,
      error_message: errorMessage,
    });
  }

  answerPreCheckoutQuery(preCheckoutQueryId: string | undefined, ok: boolean, errorMessage?: string) {
    return this.callApi('answerPreCheckoutQuery', { pre_checkout_query_id: preCheckoutQueryId, ok, error_message: errorMessage });
  }

  editMessageText(chatId: number | string | undefined, messageId: number | undefined, inlineMessageId: string | undefined, text: string, extra: Record<string, any> = {}) {
    return this.callApi('editMessageText', { chat_id: chatId, message_id: messageId, inline_message_id: inlineMessageId, text, ...extra });
  }

  editMessageCaption(chatId: number | string | undefined, messageId: number | undefined, inlineMessageId: string | undefined, caption: string, extra: Record<string, any> = {}) {
    return this.callApi('editMessageCaption', { chat_id: chatId, message_id: messageId, inline_message_id: inlineMessageId, caption, ...extra });
  }

  editMessageMedia(chatId: number | string | undefined, messageId: number | undefined, inlineMessageId: string | undefined, media: any, extra: Record<string, any> = {}) {
    return this.callApi('editMessageMedia', { chat_id: chatId, message_id: messageId, inline_message_id: inlineMessageId, media, ...extra });
  }

  editMessageReplyMarkup(chatId: number | string | undefined, messageId: number | undefined, inlineMessageId: string | undefined, replyMarkup?: any) {
    return this.callApi('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, inline_message_id: inlineMessageId, reply_markup: replyMarkup });
  }

  editMessageLiveLocation(chatId: number | string | undefined, messageId: number | undefined, inlineMessageId: string | undefined, latitude: number, longitude: number, extra: Record<string, any> = {}) {
    return this.callApi('editMessageLiveLocation', { chat_id: chatId, message_id: messageId, inline_message_id: inlineMessageId, latitude, longitude, ...extra });
  }

  stopMessageLiveLocation(chatId: number | string | undefined, messageId: number | undefined, inlineMessageId: string | undefined, replyMarkup?: any) {
    return this.callApi('stopMessageLiveLocation', { chat_id: chatId, message_id: messageId, inline_message_id: inlineMessageId, reply_markup: replyMarkup });
  }

  deleteMessage(chatId: number | string, messageId: number) {
    return this.callApi('deleteMessage', { chat_id: chatId, message_id: messageId });
  }

  getChat(chatId: number | string) {
    return this.callApi('getChat', { chat_id: chatId });
  }

  getChatAdministrators(chatId: number | string) {
    return this.callApi('getChatAdministrators', { chat_id: chatId });
  }

  getChatMember(chatId: number | string, userId: number) {
    return this.callApi('getChatMember', { chat_id: chatId, user_id: userId });
  }

  getChatMembersCount(chatId: number | string) {
    return this.callApi('getChatMembersCount', { chat_id: chatId });
  }

  pinChatMessage(chatId: number | string, messageId: number, extra: Record<string, any> = {}) {
    return this.callApi('pinChatMessage', { chat_id: chatId, message_id: messageId, ...extra });
  }

  unpinChatMessage(chatId: number | string, messageId?: number) {
    return this.callApi('unpinChatMessage', { chat_id: chatId, message_id: messageId });
  }

  unpinAllChatMessages(chatId: number | string) {
    return this.callApi('unpinAllChatMessages', { chat_id: chatId });
  }

  leaveChat(chatId: number | string) {
    return this.callApi('leaveChat', { chat_id: chatId });
  }

  setMessageReaction(chatId: number | string, messageId: number, reaction?: any[], isBig?: boolean) {
    return this.callApi('setMessageReaction', { chat_id: chatId, message_id: messageId, reaction, is_big: isBig });
  }

  private registerSentMedia(kind: LocalFileKind, message: any, aliases: string[] = []) {
    const media = message?.media ?? message;
    if (media?.photo || media?.document) {
      registerLocalFile(kind, media, media.document?.size?.toJSNumber?.() ?? media.document?.size, aliases);
    }
    return message;
  }

  private async sendResolvedMedia(method: string, params: Record<string, any>, mediaKey: string, kind: LocalFileKind, unsetKeys: string[] = [mediaKey]) {
    const chatId = params.chat_id ?? params.chatId ?? params.chat;
    const resolved = await resolveInputFile(method, params, params[mediaKey], mediaKey);
    if (resolved.botApiFileId) {
      if (this.allowBotApiFallback) return this.botApiCall(method, params);
      throw botApiFileIdUnsupported(method, params, resolved.botApiFileId);
    }

    const cleanParams = { ...params };
    for (const key of unsetKeys) cleanParams[key] = undefined;
    const message = await this.client.sendMessage(resolvePeer(chatId), mapSendOptions({
      ...cleanParams,
      file: resolved.value,
      message: params.caption ?? '',
    }));
    return this.registerSentMedia(kind, message);
  }

  private async botApiCall(method: string, params: Record<string, any> = {}) {
    if (!this.allowBotApiFallback) {
      throw new TelegramError(
        `Telegram Bot API method ${method} has no pure MTProto implementation here. Configure botApiMode: 'local-bot-api' with a reachable apiRoot, or enable allowBotApiFallback only when HTTP Bot API access is available.`,
        undefined,
        { method, payload: params }
      );
    }

    const payload = compact(normalizeFmtStringParams(method, params));
    const response = await fetch(`${this.apiRoot}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => undefined) as any;
    if (!response.ok || !body?.ok) {
      throw new TelegramError(
        body?.description ?? `Telegram Bot API method ${method} failed`,
        body,
        { method, payload }
      );
    }

    return body.result;
  }

  private getBotApiFileUrl(filePath: string) {
    return new URL(`${this.apiRoot}/file/bot${this.token}/${filePath}`);
  }

  async callApi(method: any, params: any = {}, opts?: any): Promise<any> {
    if (method === 'getFile') {
      const file = await resolveInputFile(method, params, params.file_id ?? params.fileId, 'file_id');
      if (file.local) {
        return {
          file_id: file.local.id,
          file_unique_id: file.local.uniqueId,
          file_size: file.local.size,
          mtproto: true,
        };
      }
      if (file.botApiFileId && !this.allowBotApiFallback) {
        throw botApiFileIdUnsupported(method, params, file.botApiFileId);
      }
      return this.botApiCall('getFile', { file_id: params.file_id ?? params.fileId });
    }

    if (method === 'getFileLink') {
      const resolved = await resolveInputFile(method, params, params.file_id ?? params.fileId, 'file_id');
      if (resolved.local || isLocalFileId(params.file_id ?? params.fileId)) {
        throw new TelegramError('MTProto local file IDs do not have HTTP file links. Use telegram.downloadFile(fileId) instead.', undefined, { method, payload: params });
      }
      if (resolved.botApiFileId && !this.allowBotApiFallback) {
        throw botApiFileIdUnsupported(method, params, resolved.botApiFileId);
      }

      const file = typeof params.file_id === 'object'
        ? params.file_id
        : await this.botApiCall('getFile', { file_id: params.file_id ?? params.fileId });
      const filePath = file.file_path ?? file.filePath;
      if (!filePath) {
        throw new TelegramError('Telegram file_path is missing from getFile result', file, { method, payload: params });
      }
      return this.getBotApiFileUrl(filePath);
    }

    if (!this.connected) await this.connect();

    const chatId = params.chat_id ?? params.chatId ?? params.chat;
    const peer = resolvePeer(chatId);

    switch (method) {
      case 'getMe':
        return this.client.getMe();
      case 'sendMessage':
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions(params));
      case 'sendPhoto':
        return this.sendResolvedMedia(method, params, 'photo', 'photo');
      case 'sendDocument':
        return this.sendResolvedMedia(method, params, 'document', 'document');
      case 'sendVideo':
        return this.sendResolvedMedia(method, params, 'video', 'video');
      case 'sendAudio':
        return this.sendResolvedMedia(method, params, 'audio', 'audio');
      case 'sendVoice':
        return this.sendResolvedMedia(method, params, 'voice', 'voice');
      case 'sendAnimation':
        return this.sendResolvedMedia(method, params, 'animation', 'animation');
      case 'sendSticker':
        return this.sendResolvedMedia(method, params, 'sticker', 'sticker');
      case 'sendMediaGroup': {
        const group = await resolveMediaGroup(method, params);
        if (group.botApiFileId) {
          if (this.allowBotApiFallback) return this.botApiCall(method, params);
          throw botApiFileIdUnsupported(method, params, group.botApiFileId);
        }
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: group.media, ...params, media: undefined }));
      }
      case 'sendLocation':
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaGeoPoint({ geoPoint: new Api.InputGeoPoint({ lat: params.latitude, long: params.longitude }) }), ...params }));
      case 'sendVenue':
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaVenue({ geoPoint: new Api.InputGeoPoint({ lat: params.latitude, long: params.longitude }), title: params.title, address: params.address, provider: 'foursquare', venueId: params.foursquare_id ?? '', venueType: params.foursquare_type ?? '' }), ...params }));
      case 'sendContact':
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaContact({ phoneNumber: params.phone_number ?? params.phoneNumber, firstName: params.first_name ?? params.firstName, lastName: params.last_name ?? params.lastName ?? '', vcard: params.vcard ?? '' }), ...params }));
      case 'sendDice':
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaDice(params.emoji ?? '🎲'), ...params }));
      case 'sendVideoNote':
        return this.sendResolvedMedia(method, { ...params, video_note: params.video_note ?? params.videoNote }, 'video_note', 'video_note', ['video_note', 'videoNote']);
      case 'sendPoll':
      case 'sendQuiz':
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({
          message: params.question,
          buttons: (params.options ?? []).map((option: string) => [option]),
          ...params,
        }));
      case 'sendInvoice':
      case 'sendGame':
        return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ message: params.title ?? params.game_short_name ?? params.gameName ?? '', ...params }));
      case 'sendChatAction':
        return this.client.invoke(new Api.messages.SetTyping({ peer, action: mapChatAction(params.action) }));
      case 'answerCallbackQuery':
        return this.client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: params.callback_query_id ?? params.query_id ?? params.id, message: params.text ?? '', cacheTime: params.cache_time ?? 0, alert: params.show_alert ?? false, url: params.url }));
      case 'answerInlineQuery':
      case 'answerShippingQuery':
      case 'answerPreCheckoutQuery':
        return this.botApiCall(method, params);
      case 'editMessageText':
        return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, text: params.text ?? params.message, parseMode: params.parse_mode, formattingEntities: params.entities, linkPreview: !params.disable_web_page_preview, buttons: convertReplyMarkup(params.reply_markup), file: params.media ?? params.file });
      case 'editMessageCaption':
        return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, text: params.caption, parseMode: params.parse_mode, formattingEntities: params.entities, linkPreview: !params.disable_web_page_preview, buttons: convertReplyMarkup(params.reply_markup), file: params.media ?? params.file });
      case 'editMessageMedia': {
        const media = params.media?.media ?? params.media ?? params.file;
        const resolved = await resolveInputFile(method, params, media, 'media');
        if (resolved.botApiFileId) {
          if (this.allowBotApiFallback) return this.botApiCall(method, params);
          throw botApiFileIdUnsupported(method, params, resolved.botApiFileId);
        }
        return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, file: resolved.value, text: params.caption ?? params.media?.caption, parseMode: params.parse_mode ?? params.media?.parse_mode, formattingEntities: params.entities ?? params.media?.caption_entities, buttons: convertReplyMarkup(params.reply_markup) });
      }
      case 'editMessageReplyMarkup':
        return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, buttons: convertReplyMarkup(params.reply_markup) });
      case 'editMessageLiveLocation':
        return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, file: new Api.InputMediaGeoPoint({ geoPoint: new Api.InputGeoPoint({ lat: params.latitude, long: params.longitude }) }), buttons: convertReplyMarkup(params.reply_markup) });
      case 'stopMessageLiveLocation':
        return this.botApiCall(method, params);
      case 'deleteMessage':
        return this.client.deleteMessages(peer, [params.message_id ?? params.messageId], { revoke: false });
      case 'forwardMessage':
        return this.client.forwardMessages(peer, { fromPeer: resolvePeer(params.from_chat_id ?? params.fromChatId), messages: [params.message_id ?? params.messageId], silent: params.disable_notification, schedule: params.schedule_date });
      case 'copyMessage':
        return this.client.forwardMessages(peer, { fromPeer: resolvePeer(params.from_chat_id ?? params.fromChatId), messages: [params.message_id ?? params.messageId], dropAuthor: true, silent: params.disable_notification, schedule: params.schedule_date });
      case 'getChat':
        return this.client.getEntity(peer);
      case 'getChatAdministrators':
        return this.client.getParticipants(peer, { limit: 200 });
      case 'getChatMember':
        return this.client.invoke(new Api.channels.GetParticipant({ channel: peer, participant: resolvePeer(params.user_id ?? params.userId) }));
      case 'getChatMemberCount':
      case 'getChatMembersCount':
        return this.client.getParticipants(peer, { limit: 0 }).then((participants: any) => participants.total ?? participants.length ?? 0);
      case 'pinChatMessage':
        return this.client.invoke(new Api.messages.UpdatePinnedMessage({ peer, id: params.message_id ?? params.messageId, silent: params.disable_notification ?? false }));
      case 'unpinChatMessage':
        return this.client.invoke(new Api.messages.UpdatePinnedMessage({ peer, id: params.message_id ?? params.messageId ?? 0, unpin: true }));
      case 'unpinAllChatMessages':
        return this.client.invoke(new Api.messages.UnpinAllMessages({ peer }));
      case 'leaveChat':
        return this.client.invoke(new Api.channels.LeaveChannel({ channel: peer })).then(() => true).catch(() => this.client.invoke(new Api.messages.DeleteChatUser({ chatId: peer, userId: 'self' })).then(() => true));
      case 'setMessageReaction':
        return this.botApiCall(method, params);
      case 'setWebhook':
      case 'deleteWebhook':
        return this.botApiCall(method, params);
      case 'getWebhookInfo':
        return this.botApiCall(method, params);
      case 'getUpdates':
        return this.botApiCall(method, params);
      case 'getUserChatBoosts':
        return this.botApiCall(method, params);
      default:
        return this.botApiCall(method, params);
    }
  }
}
