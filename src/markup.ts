type Button = string | Record<string, any>;
type MarkupResult = {
  reply_markup: Record<string, any>;
  resize(): MarkupResult;
  oneTime(): MarkupResult;
  persistent(): MarkupResult;
  selective(): MarkupResult;
  placeholder(text: string): MarkupResult;
};

function normalizeRows(buttons: Button[] | Button[][]) {
  if (!buttons.length || !Array.isArray(buttons[0])) {
    return [buttons as Button[]];
  }
  return buttons as Button[][];
}

function withKeyboardMethods(reply_markup: Record<string, any>): MarkupResult {
  const result = {
    reply_markup,
    resize() {
      reply_markup.resize_keyboard = true;
      return result;
    },
    oneTime() {
      reply_markup.one_time_keyboard = true;
      return result;
    },
    persistent() {
      reply_markup.is_persistent = true;
      return result;
    },
    selective() {
      reply_markup.selective = true;
      return result;
    },
    placeholder(text: string) {
      reply_markup.input_field_placeholder = text;
      return result;
    },
  };
  return result;
}

export function button(text: string, options: Record<string, any> = {}) {
  return { text, ...options };
}

export namespace button {
  export function callback(text: string, data: string, hide = false) {
    return { text, callback_data: data, hide };
  }

  export function url(text: string, url: string, hide = false) {
    return { text, url, hide };
  }

  export function switchToChat(text: string, value: string, hide = false) {
    return { text, switch_inline_query: value, hide };
  }

  export function switchToCurrentChat(text: string, value: string, hide = false) {
    return { text, switch_inline_query_current_chat: value, hide };
  }

  export function contactRequest(text: string, hide = false) {
    return { text, request_contact: true, hide };
  }

  export function locationRequest(text: string, hide = false) {
    return { text, request_location: true, hide };
  }

  export function webApp(text: string, url: string, hide = false) {
    return { text, web_app: { url }, hide };
  }
}

function visibleRows(buttons: Button[] | Button[][]) {
  return normalizeRows(buttons)
    .map((row) => row.filter((item: any) => !item?.hide))
    .filter((row) => row.length > 0);
}

export function inlineKeyboard(buttons: Button[] | Button[][]) {
  return withKeyboardMethods({ inline_keyboard: visibleRows(buttons) });
}

export function keyboard(buttons: Button[] | Button[][]) {
  return withKeyboardMethods({
    keyboard: visibleRows(buttons).map((row) => row.map((item) => typeof item === 'string' ? { text: item } : item)),
  });
}

export function removeKeyboard(selective?: boolean) {
  return { reply_markup: { remove_keyboard: true, selective } };
}

export function forceReply(extra: Record<string, any> = {}) {
  return { reply_markup: { force_reply: true, ...extra } };
}

export default {
  button,
  inlineKeyboard,
  keyboard,
  removeKeyboard,
  forceReply,
};
