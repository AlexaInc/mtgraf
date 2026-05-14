export const file = (source: string | Buffer | object) => source;
export const url = (source: string) => source;
export const media = (source: any) => source;

export default {
  file,
  url,
  media,
};
