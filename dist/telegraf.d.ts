import { Composer } from './composer';
import { Context } from './context';
import { Telegram } from './telegram';
export interface TelegrafOptions {
    apiId?: number;
    apiHash?: string;
    session?: string;
    connectionRetries?: number;
    telegram?: Record<string, any>;
}
export interface LaunchOptions {
    dropPendingUpdates?: boolean;
}
export declare class Telegraf<C extends Context = Context> extends Composer<C> {
    telegram: Telegram;
    botInfo: unknown;
    private running;
    private readonly token;
    constructor(token: string, options?: TelegrafOptions);
    private handleError;
    catch(handler: (err: unknown, ctx: C) => Promise<void> | void): this;
    launch(config?: LaunchOptions | (() => void), onLaunch?: () => void): Promise<this>;
    stop(): Promise<this>;
    webhookCallback(path?: string, opts?: {
        secretToken?: string;
    }): void;
    createWebhook(opts: {
        domain: string;
        path?: string;
    } & Record<string, any>): void;
    private registerEventHandlers;
    private handleNewMessage;
    private handleEditedMessage;
    private handleCallbackQuery;
    private dispatch;
}
//# sourceMappingURL=telegraf.d.ts.map