import { Telegram as BaseTelegram } from 'telegraf';
import { TelegramClient } from 'telegram';
export declare class Telegram extends BaseTelegram {
    client: TelegramClient;
    private connected;
    constructor(token: string, options?: Record<string, any>);
    connect(): Promise<this>;
    disconnect(): Promise<this | undefined>;
    callApi(method: any, params?: any, opts?: any): Promise<any>;
}
//# sourceMappingURL=telegram.d.ts.map