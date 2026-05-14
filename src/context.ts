import { Telegram } from './telegram';

export class Context {
  update: any;
  telegram: Telegram;
  botInfo?: any;
  state: Record<string, any> = {};
  match: RegExpExecArray | string[] | null = null;

  constructor(update: any, telegram: Telegram, botInfo?: any) {
    this.update = update;
    this.telegram = telegram;
    this.botInfo = botInfo;
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
    return this.update.message ?? this.update.edited_message ?? undefined;
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
      this.myChatMember?.from ||
      this.chatMember?.from ||
      this.chatJoinRequest?.from
    );
  }

  get inlineMessageId() {
    return this.callbackQuery?.inline_message_id ?? this.chosenInlineResult?.inline_message_id;
  }

  get passportData() {
    if (!this.message) return undefined;
    return this.message.passport_data;
  }

  get webAppData() {
    const msg = this.message;
    if (!msg || !('web_app_data' in msg)) return undefined;
    const { data, button_text } = msg.web_app_data;
    return {
      data: {
        json: <T>() => JSON.parse(data) as T,
        text: () => data,
      },
      button_text,
    };
  }

  get text() {
    return this.msg?.text ?? this.msg?.caption;
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

  reply(text: string, extra: Record<string, any> = {}) {
    return this.telegram.sendMessage(this.chatId, text, { ...(extra as any), reply_to_message_id: this.msgId } as any);
  }

  replyWithMarkdown(text: string, extra: Record<string, any> = {}) {
    return this.reply(text, { ...extra, parse_mode: 'Markdown' });
  }

  replyWithHTML(text: string, extra: Record<string, any> = {}) {
    return this.reply(text, { ...extra, parse_mode: 'HTML' });
  }

  replyWithPhoto(photo: any, extra: Record<string, any> = {}) {
    return this.telegram.sendPhoto(this.chatId, photo, extra);
  }

  replyWithDocument(document: any, extra: Record<string, any> = {}) {
    return this.telegram.sendDocument(this.chatId, document, extra);
  }

  replyWithVideo(video: any, extra: Record<string, any> = {}) {
    return this.telegram.sendVideo(this.chatId, video, extra);
  }

  replyWithAudio(audio: any, extra: Record<string, any> = {}) {
    return this.telegram.sendAudio(this.chatId, audio, extra);
  }

  replyWithSticker(sticker: any, extra: Record<string, any> = {}) {
    return this.telegram.sendSticker(this.chatId, sticker, extra);
  }

  replyWithAnimation(animation: any, extra: Record<string, any> = {}) {
    return this.telegram.sendAnimation(this.chatId, animation, extra);
  }

  replyWithVoice(voice: any, extra: Record<string, any> = {}) {
    return this.telegram.sendVoice(this.chatId, voice, extra);
  }

  replyWithMediaGroup(media: any[], extra: Record<string, any> = {}) {
    return this.telegram.sendMediaGroup(this.chatId, media, extra);
  }

  replyWithLocation(latitude: number, longitude: number, extra: Record<string, any> = {}) {
    return this.telegram.sendLocation(this.chatId, latitude, longitude, extra);
  }

  replyWithVenue(latitude: number, longitude: number, title: string, address: string, extra: Record<string, any> = {}) {
    return this.telegram.sendVenue(this.chatId, latitude, longitude, title, address, extra);
  }

  replyWithContact(phoneNumber: string, firstName: string, lastName?: string, extra: Record<string, any> = {}) {
    return this.telegram.sendContact(this.chatId, phoneNumber, firstName, { ...(extra as any), last_name: lastName } as any);
  }

  replyWithDice(extra: Record<string, any> = {}) {
    return this.telegram.sendDice(this.chatId, extra);
  }

  answerCbQuery(text?: string, extra: Record<string, any> = {}) {
    return this.telegram.answerCbQuery(this.callbackQuery?.id, text, extra);
  }

  deleteMessage(messageId?: number) {
    const id = messageId ?? this.msgId;
    if (id === undefined) {
      throw new Error('Message id is required to delete a message');
    }
    return this.telegram.deleteMessage(this.chatId, id);
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

  editMessageReplyMarkup(extra: Record<string, any> = {}) {
    const messageId = this.msgId;
    if (messageId === undefined) {
      throw new Error('Message id is required to edit message reply markup');
    }
    return this.telegram.editMessageReplyMarkup(this.chatId, messageId, undefined, extra as any);
  }
}
