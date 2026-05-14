import { Composer } from './composer';
import { Context } from './context';
import { NewMessage } from 'telegram/events';
import { EditedMessage } from 'telegram/events/EditedMessage';
import { CallbackQuery } from 'telegram/events/CallbackQuery';
import { Telegram } from './telegram';
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
function convertPeerId(peer) {
    return peer?.userId ?? peer?.chatId ?? peer?.channelId ?? peer;
}
function convertUser(fromId) {
    if (!fromId)
        return undefined;
    const id = convertPeerId(fromId);
    return { id, is_bot: false, first_name: '', last_name: '' };
}
function convertChat(peer) {
    if (!peer)
        return undefined;
    const chatId = convertPeerId(peer);
    const type = peer?.userId ? 'private' : peer?.chatId ? 'group' : peer?.channelId ? 'channel' : undefined;
    return { id: chatId, type };
}
function convertMessage(message) {
    if (!message)
        return undefined;
    const result = {
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
        if (media.photo)
            result.photo = media.photo;
        if (media.document)
            result.document = media.document;
        if (media.video)
            result.video = media.video;
        if (media.audio)
            result.audio = media.audio;
        if (media.voice)
            result.voice = media.voice;
        if (media.animation)
            result.animation = media.animation;
        if (media.geoPoint)
            result.location = {
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
function convertCallbackQuery(event, message) {
    if (!event)
        return undefined;
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
export class Telegraf extends Composer {
    constructor(token, options = {}) {
        super();
        this.running = false;
        this.handleError = async (err, ctx) => {
            console.error('Unhandled error while processing update', err, ctx);
            throw err;
        };
        if (!token) {
            throw new Error('Telegraf token is required');
        }
        this.token = token;
        this.telegram = new Telegram(token, options);
    }
    catch(handler) {
        this.handleError = handler;
        return this;
    }
    async launch(config = {}, onLaunch) {
        const [cfg, onMe] = typeof config === 'function' ? [{}, config] : [config, onLaunch];
        if (cfg && cfg.webhook) {
            throw new Error('Webhooks are not supported with the GramJS Telegraf backend');
        }
        await this.telegram.connect();
        this.botInfo ?? (this.botInfo = await this.telegram.getMe());
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
    webhookCallback(path = '/', opts = {}) {
        throw new Error('webhookCallback is not supported with the GramJS Telegraf backend');
    }
    createWebhook(opts) {
        throw new Error('createWebhook is not supported with the GramJS Telegraf backend');
    }
    registerEventHandlers() {
        this.telegram.client.addEventHandler(this.handleNewMessage.bind(this), new NewMessage({}));
        this.telegram.client.addEventHandler(this.handleEditedMessage.bind(this), new EditedMessage({}));
        this.telegram.client.addEventHandler(this.handleCallbackQuery.bind(this), new CallbackQuery());
    }
    async handleNewMessage(event) {
        const update = { message: convertMessage(event.message) };
        await this.dispatch(update);
    }
    async handleEditedMessage(event) {
        const update = { edited_message: convertMessage(event.message) };
        await this.dispatch(update);
    }
    async handleCallbackQuery(event) {
        const message = event.message ?? (typeof event.getMessage === 'function' ? await event.getMessage().catch(() => undefined) : undefined);
        const callbackQuery = convertCallbackQuery(event, message);
        if (!callbackQuery)
            return;
        await this.dispatch({ callback_query: callbackQuery });
    }
    async dispatch(update) {
        if (!update) {
            return;
        }
        const ctx = new Context(update, this.telegram, this.botInfo);
        const middleware = this.middleware();
        try {
            await middleware(ctx, async () => Promise.resolve());
        }
        catch (error) {
            await this.handleError(error, ctx);
        }
    }
}
