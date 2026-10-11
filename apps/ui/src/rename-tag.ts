import { tagKey } from './inline-tags';

export function renamedTag(tag: string, from: string, to: string) {
  tag = tagKey(tag); from = tagKey(from); to = tagKey(to);
  return tag === from || tag.startsWith(from + "/") ? to + tag.slice(from.length) : tag;
}
