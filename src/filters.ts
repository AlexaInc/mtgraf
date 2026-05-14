// Author: AlexaInc
// Package: mtgraf
// Copyright (c) 2026 AlexaInc

type Update = Record<string, any>;

function hasPath(value: any, path: string[]) {
  let current = value;
  for (const segment of path) {
    if (current == null || !(segment in current)) return false;
    current = current[segment];
  }
  return current !== undefined && current !== null;
}

export function message(...keys: string[]) {
  return (update: Update) => {
    if (!update.message) return false;
    return keys.length === 0 || keys.some((key) => hasPath(update.message, key.split('.')));
  };
}

export function editedMessage(...keys: string[]) {
  return (update: Update) => {
    if (!update.edited_message) return false;
    return keys.length === 0 || keys.some((key) => hasPath(update.edited_message, key.split('.')));
  };
}

export function channelPost(...keys: string[]) {
  return (update: Update) => {
    if (!update.channel_post) return false;
    return keys.length === 0 || keys.some((key) => hasPath(update.channel_post, key.split('.')));
  };
}

export function callbackQuery(...keys: string[]) {
  return (update: Update) => {
    if (!update.callback_query) return false;
    return keys.length === 0 || keys.some((key) => hasPath(update.callback_query, key.split('.')));
  };
}

export function inlineQuery() {
  return (update: Update) => Boolean(update.inline_query);
}

export function anyOf(...filters: Array<(update: Update) => boolean>) {
  return (update: Update) => filters.some((filter) => filter(update));
}

export function allOf(...filters: Array<(update: Update) => boolean>) {
  return (update: Update) => filters.every((filter) => filter(update));
}
