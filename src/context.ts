// Author: AlexaInc
// Package: mtgraf
// Copyright (c) 2026 AlexaInc

import { Telegram } from './telegram';

const contextNoChatTelegramMethods = new Set([
  'getMe',
  'getFile',
  'getFileLink',
  'downloadFile',
  'getUpdates',
  'getWebhookInfo',
  'setWebhook',
  'deleteWebhook',
  'answerInlineQuery',
  'answerCbQuery',
  'answerCallbackQuery',
  'answerShippingQuery',
  'answerPreCheckoutQuery',
]);

export class Context {
  [property: string]: any;
  update: any;
  telegram: Telegram;
  botInfo?: any;
  state: Record<string, any> = {};
  match: RegExpExecArray | string[] | null = null;
  payload = '';
  args: string[] = [];

  constructor(update: any, telegram: Telegram, botInfo?: any) {
    this.update = update;
    this.telegram = telegram;
    this.botInfo = botInfo;

    return new Proxy(this, {
      get(target, property, receiver) {
        if (typeof property !== 'string' || property in target) {
          return Reflect.get(target, property, receiver);
        }

        const telegramMethod = (target.telegram as any)[property];
        if (typeof telegramMethod !== 'function') {
          return undefined;
        }

        return (...args: any[]) => {
          if (contextNoChatTelegramMethods.has(property)) {
            return telegramMethod.apply(target.telegram, args);
          }
          return telegramMethod.call(target.telegram, target.requireChatId(property), ...args);
        };
      },
    });
  }

  get updateType() {
    for (const key in this.update) {
      if (this.update[key] && typeof this.update[key] === 'object') {
        return key;
      }
    }
    return 'unknown';
  }

  get me() {
    return this.botInfo?.username;
  }

  get tg() {
    return this.telegram;
  }

  get message() {
    return this.update.message ?? undefined;
  }

  get editedMessage() {
    return this.update.edited_message ?? undefined;
  }

  get inlineQuery() {
    return this.update.inline_query ?? undefined;
  }

  get shippingQuery() {
    return this.update.shipping_query ?? undefined;
  }

  get preCheckoutQuery() {
    return this.update.pre_checkout_query ?? undefined;
  }

  get chosenInlineResult() {
    return this.update.chosen_inline_result ?? undefined;
  }

  get channelPost() {
    return this.update.channel_post ?? undefined;
  }

  get editedChannelPost() {
    return this.update.edited_channel_post ?? undefined;
  }

  get messageReaction() {
    return this.update.message_reaction ?? undefined;
  }

  get messageReactionCount() {
    return this.update.message_reaction_count ?? undefined;
  }

  get poll() {
    return this.update.poll ?? undefined;
  }

  get pollAnswer() {
    return this.update.poll_answer ?? undefined;
  }

  get myChatMember() {
    return this.update.my_chat_member ?? undefined;
  }

  get chatMember() {
    return this.update.chat_member ?? undefined;
  }

  get chatJoinRequest() {
    return this.update.chat_join_request ?? undefined;
  }

  get chatBoost() {
    return this.update.chat_boost ?? undefined;
  }

  get removedChatBoost() {
    return this.update.removed_chat_boost ?? undefined;
  }

  get callbackQuery() {
    return this.update.callback_query ?? undefined;
  }

  get msg() {
    return (
      this.message ||
      this.editedMessage ||
      this.channelPost ||
      this.editedChannelPost ||
      this.callbackQuery?.message
    );
  }

  get msgId() {
    return this.msg?.message_id ?? this.msg?.id;
  }

  get chat() {
    return this.msg?.chat ?? this.callbackQuery?.message?.chat;
  }

  get senderChat() {
    return this.msg?.sender_chat;
  }

  get from() {
    return (
      this.msg?.from ||
      this.callbackQuery?.from ||
      this.inlineQuery?.from ||
      this.chosenInlineResult?.from ||
      this.shippingQuery?.from ||
      this.preCheckoutQuery?.from ||
      this.pollAnswer?.user ||
      this.myChatMember?.from ||
      this.chatMember?.from ||
      this.chatJoinRequest?.from ||
      this.messageReaction?.user
    );
  }

  get inlineMessageId() {
    return this.callbackQuery?.inline_message_id ?? this.chosenInlineResult?.inline_message_id;
  }

  get passportData() {
    return this.message?.passport_data;
  }

  get webAppData() {
    const data = this.message?.web_app_data;
    if (!data) return undefined;
    return {
      data: {
        json: <T>() => JSON.parse(data.data) as T,
        text: () => data.data,
      },
      button_text: data.button_text,
    };
  }

  get webhookReply() {
    return (this.telegram as any).webhookReply ?? false;
  }

  set webhookReply(enable: boolean) {
    (this.telegram as any).webhookReply = enable;
  }

  get reactions() {
    const oldReaction = this.messageReaction?.old_reaction ?? [];
    const newReaction = this.messageReaction?.new_reaction ?? [];
    return {
      old: oldReaction,
      new: newReaction,
      added: newReaction.filter((item: any) => !oldReaction.includes(item)),
      removed: oldReaction.filter((item: any) => !newReaction.includes(item)),
      has: (reaction: any) => {
        const value = typeof reaction === 'string' ? reaction : reaction?.emoji ?? reaction?.custom_emoji_id;
        return newReaction.some((item: any) => item === reaction || item?.emoji === value || item?.custom_emoji_id === value);
      },
    };
  }

  get text() {
    return this.msg?.text ?? this.msg?.message ?? this.msg?.caption;
  }

  entities(...types: string[]) {
    const text = this.text ?? '';
    const all = [...(this.msg?.entities ?? []), ...(this.msg?.caption_entities ?? [])];
    const allowed = new Set(types);
    return all
      .filter((entity: any) => !types.length || allowed.has(entity.type))
      .map((entity: any) => ({ ...entity, fragment: text.slice(entity.offset, entity.offset + entity.length) }));
  }

  has(filters: string | Array<string> | ((update: any) => boolean)) {
    if (typeof filters === 'function') {
      return filters(this.update);
    }
    const list = Array.isArray(filters) ? filters : [filters];
    return list.some((filter) => filter in this.update);
  }

  assert(value: any, method: string): asserts value {
    if (value === undefined || value === null) {
      throw new TypeError(`Telegraf: "${method}" isn't available for "${this.updateType}"`);
    }
  }

  get chatId() {
    return this.chat?.id ?? this.msg?.peerId?.userId ?? this.msg?.peerId?.chatId ?? this.msg?.peerId?.channelId;
  }

  private requireChatId(method: string) {
    const chatId = this.chatId;
    this.assert(chatId, method);
    return chatId;
  }

  private requireFromId(method: string) {
    const fromId = this.from?.id;
    this.assert(fromId, method);
    return fromId;
  }

  sendMessage(text: string, extra: Record<string, any> = {}) {
    return this.telegram.sendMessage(this.requireChatId('sendMessage'), text, extra);
  }

  reply(text: string, extra: Record<string, any> = {}) {
    return this.telegram.sendMessage(this.requireChatId('reply'), text, { ...(extra as any), reply_to_message_id: this.msgId } as any);
  }

  replyWithMarkdown(text: string, extra: Record<string, any> = {}) {
    return this.reply(text, { ...extra, parse_mode: 'Markdown' });
  }

  replyWithMarkdownV2(text: string, extra: Record<string, any> = {}) {
    return this.reply(text, { ...extra, parse_mode: 'MarkdownV2' });
  }

  replyWithHTML(text: string, extra: Record<string, any> = {}) {
    return this.reply(text, { ...extra, parse_mode: 'HTML' });
  }

  sendPhoto(photo: any, extra: Record<string, any> = {}) {
    return this.telegram.sendPhoto(this.requireChatId('sendPhoto'), photo, extra);
  }

  replyWithPhoto(photo: any, extra: Record<string, any> = {}) {
    return this.sendPhoto(photo, extra);
  }

  sendDocument(document: any, extra: Record<string, any> = {}) {
    return this.telegram.sendDocument(this.requireChatId('sendDocument'), document, extra);
  }

  replyWithDocument(document: any, extra: Record<string, any> = {}) {
    return this.sendDocument(document, extra);
  }

  sendVideo(video: any, extra: Record<string, any> = {}) {
    return this.telegram.sendVideo(this.requireChatId('sendVideo'), video, extra);
  }

  replyWithVideo(video: any, extra: Record<string, any> = {}) {
    return this.sendVideo(video, extra);
  }

  sendAudio(audio: any, extra: Record<string, any> = {}) {
    return this.telegram.sendAudio(this.requireChatId('sendAudio'), audio, extra);
  }

  replyWithAudio(audio: any, extra: Record<string, any> = {}) {
    return this.sendAudio(audio, extra);
  }

  sendSticker(sticker: any, extra: Record<string, any> = {}) {
    return this.telegram.sendSticker(this.requireChatId('sendSticker'), sticker, extra);
  }

  replyWithSticker(sticker: any, extra: Record<string, any> = {}) {
    return this.sendSticker(sticker, extra);
  }

  sendAnimation(animation: any, extra: Record<string, any> = {}) {
    return this.telegram.sendAnimation(this.requireChatId('sendAnimation'), animation, extra);
  }

  replyWithAnimation(animation: any, extra: Record<string, any> = {}) {
    return this.sendAnimation(animation, extra);
  }

  sendVoice(voice: any, extra: Record<string, any> = {}) {
    return this.telegram.sendVoice(this.requireChatId('sendVoice'), voice, extra);
  }

  replyWithVoice(voice: any, extra: Record<string, any> = {}) {
    return this.sendVoice(voice, extra);
  }

  sendVideoNote(videoNote: any, extra: Record<string, any> = {}) {
    return (this.telegram as any).sendVideoNote(this.requireChatId('sendVideoNote'), videoNote, extra);
  }

  replyWithVideoNote(videoNote: any, extra: Record<string, any> = {}) {
    return this.sendVideoNote(videoNote, extra);
  }

  sendMediaGroup(media: any[], extra: Record<string, any> = {}) {
    return this.telegram.sendMediaGroup(this.requireChatId('sendMediaGroup'), media, extra);
  }

  replyWithMediaGroup(media: any[], extra: Record<string, any> = {}) {
    return this.sendMediaGroup(media, extra);
  }

  sendLocation(latitude: number, longitude: number, extra: Record<string, any> = {}) {
    return this.telegram.sendLocation(this.requireChatId('sendLocation'), latitude, longitude, extra);
  }

  replyWithLocation(latitude: number, longitude: number, extra: Record<string, any> = {}) {
    return this.sendLocation(latitude, longitude, extra);
  }

  sendVenue(latitude: number, longitude: number, title: string, address: string, extra: Record<string, any> = {}) {
    return this.telegram.sendVenue(this.requireChatId('sendVenue'), latitude, longitude, title, address, extra);
  }

  replyWithVenue(latitude: number, longitude: number, title: string, address: string, extra: Record<string, any> = {}) {
    return this.sendVenue(latitude, longitude, title, address, extra);
  }

  sendContact(phoneNumber: string, firstName: string, extra: Record<string, any> = {}) {
    return this.telegram.sendContact(this.requireChatId('sendContact'), phoneNumber, firstName, extra);
  }

  replyWithContact(phoneNumber: string, firstName: string, lastName?: string, extra: Record<string, any> = {}) {
    return this.sendContact(phoneNumber, firstName, { ...(extra as any), last_name: lastName } as any);
  }

  sendDice(extra: Record<string, any> = {}) {
    return this.telegram.sendDice(this.requireChatId('sendDice'), extra);
  }

  replyWithDice(extra: Record<string, any> = {}) {
    return this.sendDice(extra);
  }

  sendChatAction(action: string, extra: Record<string, any> = {}) {
    return this.telegram.sendChatAction(this.requireChatId('sendChatAction'), action as any, extra);
  }

  replyWithChatAction(action: string, extra: Record<string, any> = {}) {
    return this.sendChatAction(action, extra);
  }

  replyWithPoll(question: string, options: readonly string[], extra: Record<string, any> = {}) {
    return (this.telegram as any).sendPoll(this.requireChatId('replyWithPoll'), question, options, extra);
  }

  replyWithQuiz(question: string, options: readonly string[], extra: Record<string, any> = {}) {
    return (this.telegram as any).sendQuiz(this.requireChatId('replyWithQuiz'), question, options, extra);
  }

  sendInvoice(invoice: any, extra: Record<string, any> = {}) {
    return (this.telegram as any).sendInvoice(this.requireChatId('sendInvoice'), invoice, extra);
  }

  replyWithInvoice(invoice: any, extra: Record<string, any> = {}) {
    return this.sendInvoice(invoice, extra);
  }

  replyWithGame(gameName: string, extra: Record<string, any> = {}) {
    return (this.telegram as any).sendGame(this.requireChatId('replyWithGame'), gameName, extra);
  }

  answerInlineQuery(results: readonly any[], extra: Record<string, any> = {}) {
    return (this.telegram as any).answerInlineQuery(this.inlineQuery?.id, results, extra);
  }

  answerCbQuery(text?: string, extra: Record<string, any> = {}) {
    return (this.telegram as any).answerCbQuery(this.callbackQuery?.id, text, extra);
  }

  answerGameQuery(text?: string, extra: Record<string, any> = {}) {
    return this.answerCbQuery(text, extra);
  }

  answerShippingQuery(ok: boolean, shippingOptions?: readonly any[], errorMessage?: string) {
    return (this.telegram as any).answerShippingQuery(this.shippingQuery?.id, ok, shippingOptions, errorMessage);
  }

  answerPreCheckoutQuery(ok: boolean, errorMessage?: string) {
    return (this.telegram as any).answerPreCheckoutQuery(this.preCheckoutQuery?.id, ok, errorMessage);
  }

  getUserChatBoosts() {
    return (this.telegram as any).getUserChatBoosts(this.requireChatId('getUserChatBoosts'), this.requireFromId('getUserChatBoosts'));
  }

  getChat(...args: any[]) {
    return (this.telegram.getChat as any)(this.requireChatId('getChat'), ...args);
  }

  getChatAdministrators(...args: any[]) {
    return (this.telegram.getChatAdministrators as any)(this.requireChatId('getChatAdministrators'), ...args);
  }

  getChatMember(userId?: number) {
    return this.telegram.getChatMember(this.requireChatId('getChatMember'), userId ?? this.requireFromId('getChatMember'));
  }

  getChatMembersCount() {
    return (this.telegram as any).getChatMembersCount(this.requireChatId('getChatMembersCount'));
  }

  leaveChat() {
    return (this.telegram as any).leaveChat(this.requireChatId('leaveChat'));
  }

  pinChatMessage(messageId = this.msgId, extra: Record<string, any> = {}) {
    this.assert(messageId, 'pinChatMessage');
    return (this.telegram as any).pinChatMessage(this.requireChatId('pinChatMessage'), messageId, extra);
  }

  unpinChatMessage(messageId = this.msgId) {
    return (this.telegram as any).unpinChatMessage(this.requireChatId('unpinChatMessage'), messageId);
  }

  unpinAllChatMessages() {
    return (this.telegram as any).unpinAllChatMessages(this.requireChatId('unpinAllChatMessages'));
  }

  react(reaction?: any | any[], isBig?: boolean) {
    this.assert(this.msgId, 'react');
    const reactions = reaction === undefined ? undefined : (Array.isArray(reaction) ? reaction : [reaction]).map((item) =>
      typeof item === 'string' ? { type: 'emoji', emoji: item } : item
    );
    return (this.telegram as any).setMessageReaction(this.requireChatId('react'), this.msgId, reactions, isBig);
  }

  deleteMessage(messageId?: number) {
    const id = messageId ?? this.msgId;
    if (id === undefined) {
      throw new Error('Message id is required to delete a message');
    }
    return this.telegram.deleteMessage(this.requireChatId('deleteMessage'), id);
  }

  forwardMessage(chatId: any, fromChatId: any, messageId: number, extra: Record<string, any> = {}) {
    return this.telegram.forwardMessage(chatId, fromChatId, messageId, extra);
  }

  copyMessage(chatId: any, fromChatId: any, messageId: number, extra: Record<string, any> = {}) {
    return this.telegram.copyMessage(chatId, fromChatId, messageId, extra);
  }

  editMessageText(text: string, extra: Record<string, any> = {}) {
    const messageId = this.msgId;
    if (messageId === undefined) {
      throw new Error('Message id is required to edit message text');
    }
    return this.telegram.editMessageText(this.chatId, messageId, undefined, text, extra);
  }

  editMessageCaption(caption: string, extra: Record<string, any> = {}) {
    const messageId = this.msgId;
    if (messageId === undefined) {
      throw new Error('Message id is required to edit message caption');
    }
    return this.telegram.editMessageCaption(this.chatId, messageId, undefined, caption, extra);
  }

  editMessageMedia(media: any, extra: Record<string, any> = {}) {
    const messageId = this.msgId;
    if (messageId === undefined) {
      throw new Error('Message id is required to edit message media');
    }
    return (this.telegram as any).editMessageMedia(this.chatId, messageId, undefined, media, extra);
  }

  editMessageReplyMarkup(markup: any = undefined) {
    const messageId = this.msgId;
    if (messageId === undefined) {
      throw new Error('Message id is required to edit message reply markup');
    }
    return this.telegram.editMessageReplyMarkup(this.chatId, messageId, undefined, markup as any);
  }

  editMessageLiveLocation(latitude: number, longitude: number, extra: Record<string, any> = {}) {
    const messageId = this.msgId;
    if (messageId === undefined) {
      throw new Error('Message id is required to edit live location');
    }
    return (this.telegram as any).editMessageLiveLocation(this.chatId, messageId, undefined, latitude, longitude, extra);
  }

  stopMessageLiveLocation(markup?: any) {
    const messageId = this.msgId;
    if (messageId === undefined) {
      throw new Error('Message id is required to stop live location');
    }
    return (this.telegram as any).stopMessageLiveLocation(this.chatId, messageId, undefined, markup);
  }
}
