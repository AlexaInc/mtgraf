export const file = (source: string | Buffer | NodeJS.ReadableStream | object, filename?: string) => filename ? { source, filename } : source;
export const url = (source: string) => ({ url: source });
export const media = (source: any) => source;

export default {
  file,
  url,
  media,
};
