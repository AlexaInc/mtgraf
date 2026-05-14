import { Telegram as BaseTelegram } from 'telegraf';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
function getEnvNumber(key) {
    const value = process.env[key];
    if (!value)
        return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : undefined;
}
function getEnvString(key) {
    const value = process.env[key];
    return value?.trim() ? value : undefined;
}
function resolvePeer(peer) {
    return peer === undefined || peer === null ? peer : peer;
}
function convertInlineButton(button) {
    if (!button)
        return undefined;
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
function convertReplyButton(button) {
    if (!button)
        return undefined;
    if (button.request_contact || button.requestContact) {
        return new Api.KeyboardButtonRequestPhone({ text: button.text });
    }
    if (button.request_location || button.requestLocation) {
        return new Api.KeyboardButtonRequestGeoLocation({ text: button.text });
    }
    return new Api.KeyboardButton({ text: button.text });
}
function convertReplyMarkup(markup) {
    if (!markup)
        return undefined;
    if (markup.inline_keyboard) {
        return new Api.ReplyInlineMarkup({
            rows: markup.inline_keyboard.map((row) => new Api.KeyboardButtonRow({
                buttons: row
                    .map(convertInlineButton)
                    .filter((button) => Boolean(button)),
            })),
        });
    }
    if (markup.keyboard) {
        return new Api.ReplyKeyboardMarkup({
            rows: markup.keyboard.map((row) => new Api.KeyboardButtonRow({
                buttons: row
                    .map(convertReplyButton)
                    .filter((button) => Boolean(button)),
            })),
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
function mapSendOptions(options) {
    const mapped = { ...options };
    if (options.parse_mode) {
        mapped.parseMode = options.parse_mode;
        delete mapped.parse_mode;
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
function mapChatAction(action) {
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
export class Telegram extends BaseTelegram {
    constructor(token, options = {}) {
        super(token, options);
        this.connected = false;
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
    }
    async connect() {
        if (this.connected)
            return this;
        await this.client.start({ botAuthToken: this.token });
        this.connected = true;
        return this;
    }
    async disconnect() {
        if (!this.connected)
            return this;
        await this.client.disconnect();
        this.connected = false;
    }
    async callApi(method, params = {}, opts) {
        const chatId = params.chat_id ?? params.chatId ?? params.chat;
        const peer = resolvePeer(chatId);
        switch (method) {
            case 'getMe':
                return this.client.getMe();
            case 'sendMessage':
                return this.client.sendMessage(resolvePeer(chatId), mapSendOptions(params));
            case 'sendPhoto':
            case 'sendDocument':
            case 'sendVideo':
            case 'sendAudio':
            case 'sendVoice':
            case 'sendAnimation':
            case 'sendSticker':
                return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: params[method.replace('send', '').toLowerCase()] ?? params.photo ?? params.document ?? params.video ?? params.audio ?? params.voice ?? params.animation ?? params.sticker, message: params.caption ?? '', ...params }));
            case 'sendMediaGroup':
                return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: params.media, ...params }));
            case 'sendLocation':
                return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaGeoPoint({ geoPoint: new Api.InputGeoPoint({ lat: params.latitude, long: params.longitude }) }), ...params }));
            case 'sendVenue':
                return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaVenue({ geoPoint: new Api.InputGeoPoint({ lat: params.latitude, long: params.longitude }), title: params.title, address: params.address, provider: 'foursquare', venueId: params.foursquare_id ?? '', venueType: params.foursquare_type ?? '' }), ...params }));
            case 'sendContact':
                return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaContact({ phoneNumber: params.phone_number ?? params.phoneNumber, firstName: params.first_name ?? params.firstName, lastName: params.last_name ?? params.lastName ?? '', vcard: params.vcard ?? '' }), ...params }));
            case 'sendDice':
                return this.client.sendMessage(resolvePeer(chatId), mapSendOptions({ file: new Api.InputMediaDice(params.emoji ?? '🎲'), ...params }));
            case 'sendChatAction':
                return this.client.invoke(new Api.messages.SetTyping({ peer, action: mapChatAction(params.action) }));
            case 'answerCallbackQuery':
                return this.client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: params.callback_query_id ?? params.query_id ?? params.id, message: params.text ?? '', cacheTime: params.cache_time ?? 0, alert: params.show_alert ?? false, url: params.url }));
            case 'editMessageText':
                return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, text: params.text ?? params.message, parseMode: params.parse_mode, formattingEntities: params.entities, linkPreview: !params.disable_web_page_preview, buttons: convertReplyMarkup(params.reply_markup), file: params.media ?? params.file });
            case 'editMessageCaption':
                return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, text: params.caption, parseMode: params.parse_mode, formattingEntities: params.entities, linkPreview: !params.disable_web_page_preview, buttons: convertReplyMarkup(params.reply_markup), file: params.media ?? params.file });
            case 'editMessageReplyMarkup':
                return this.client.editMessage(peer, { message: params.message_id ?? params.messageId, buttons: convertReplyMarkup(params.reply_markup) });
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
            case 'getFile':
            case 'getFileLink':
            case 'setWebhook':
            case 'deleteWebhook':
            case 'getUpdates':
            case 'getWebhookInfo':
            case 'getGameHighScores':
            case 'setGameScore':
                throw new Error(`Telegram Bot API method ${method} is not supported by the GramJS backend`);
            default:
                throw new Error(`Telegram Bot API method ${method} is not supported by the GramJS backend`);
        }
    }
}
