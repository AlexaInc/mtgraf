export * from '@telegraf/types';

export type Update = Record<string, any>;
export type Message = Record<string, any>;
export type User = Record<string, any>;
export type Chat = Record<string, any>;
export type InlineKeyboardMarkup = { inline_keyboard: any[][] };
export type ReplyKeyboardMarkup = { keyboard: any[][] };
export type InputFile = string | Buffer | object;

export function deunionize<T>(value: T): T {
  return value;
}
