import type { PropertyLabels } from '@memocard/contracts';

export const systemPropertyLabels = {'system:tags':'标签','system:updatedAt':'更新时间','system:createdAt':'创建时间','system:filename':'文件名'};
export const defaultPropertyLabel = (key:string) => systemPropertyLabels[key as keyof typeof systemPropertyLabels] ?? key.slice('property:'.length);
export const validPropertyLabel = (value:unknown): value is string => typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= 100 && ![...value].some(character => character.charCodeAt(0) < 32);
export function parsePropertyLabels(raw:string): PropertyLabels['labels'] {
  const value:unknown = JSON.parse(raw || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.entries(value).every(([key,label]) => (Object.hasOwn(systemPropertyLabels,key) || key.startsWith('property:') && key.length > 9) && validPropertyLabel(label))) throw new Error('属性名称配置无法读取。');
  return value as PropertyLabels['labels'];
}
