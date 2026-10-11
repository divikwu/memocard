import { renamedTag } from './rename-tag';
import { tagKey } from './inline-tags';

export const tagColors = [
  ['default', '默认'], ['brown', '棕色'], ['orange', '橙色'], ['yellow', '黄色'],
  ['green', '绿色'], ['blue', '蓝色'], ['purple', '紫色'], ['pink', '粉色'], ['red', '红色'],
] as const;
export type TagColor = typeof tagColors[number][0];
export const tagColorEvent = 'memocard:tag-colors';
export const tagColorKey = (vaultId: string | null | undefined) => `memocard:tag-colors:${vaultId || 'disconnected'}`;
export function readTagColors(vaultId: string | null | undefined) {
  try { return localStorage.getItem(tagColorKey(vaultId)); } catch { return null; }
}
export function parseTagColors(raw: string | null): Record<string, TagColor> {
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    // Legacy gray falls back to the default, represented by no override.
    const entries = Object.entries(value).filter(([, color]) => tagColors.some(([id]) => id === color));
    // Prefer an existing lowercase key when legacy spellings have different colors.
    return Object.fromEntries([...entries.filter(([tag]) => tag !== tagKey(tag)), ...entries.filter(([tag]) => tag === tagKey(tag))].map(([tag, color]) => [tagKey(tag), color])) as Record<string, TagColor>;
  } catch { return {}; }
}
export function subscribeTagColors(callback: () => void) {
  window.addEventListener(tagColorEvent, callback);
  window.addEventListener('storage', callback);
  return () => { window.removeEventListener(tagColorEvent, callback); window.removeEventListener('storage', callback); };
}
function save(vaultId: string | null | undefined, colors: Record<string, TagColor>) {
  localStorage.setItem(tagColorKey(vaultId), JSON.stringify(colors));
  window.dispatchEvent(new Event(tagColorEvent));
}
export function setTagColor(vaultId: string | null | undefined, tag: string, color: TagColor) {
  tag = tagKey(tag);
  const colors = { ...parseTagColors(readTagColors(vaultId)), [tag]: color };
  if (color === 'default') delete colors[tag];
  save(vaultId, colors);
}
export function renameTagColors(vaultId: string | null | undefined, from: string, to: string) {
  const colors = parseTagColors(readTagColors(vaultId));
  if (Object.keys(colors).some(tag => renamedTag(tag, from, to) !== tag)) {
    save(vaultId, Object.fromEntries(Object.entries(colors).map(([tag, color]) => [renamedTag(tag, from, to), color])));
  }
}
