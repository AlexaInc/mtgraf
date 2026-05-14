// Author: AlexaInc
// Package: mtgraf
// Copyright (c) 2026 AlexaInc

export class FmtString {
  text: string;
  entities: any[];

  constructor(text: string, entities: any[] = []) {
    this.text = text;
    this.entities = entities;
  }

  toString() {
    return this.text;
  }
}

export function fmt(strings: TemplateStringsArray, ...values: any[]) {
  return new FmtString(String.raw({ raw: strings }, ...values));
}

export function bold(value: any) {
  return new FmtString(String(value));
}

export function italic(value: any) {
  return new FmtString(String(value));
}

export function code(value: any) {
  return new FmtString(String(value));
}

export function link(text: string, url: string) {
  return new FmtString(text, [{ type: 'text_link', offset: 0, length: text.length, url }]);
}

export default {
  FmtString,
  fmt,
  bold,
  italic,
  code,
  link,
};
