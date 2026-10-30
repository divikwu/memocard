import type { PropertyLayoutPreferences, PropertyVisibility } from '@memocard/contracts';
import { systemPropertyLabels } from './property-labels';

export function validPropertyKey(value:unknown): value is string {
  return typeof value === 'string' && value === value.trim() && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    && (Object.hasOwn(systemPropertyLabels,value) || value.startsWith('property:') && value.length > 'property:'.length);
}

export function validatePropertyLayout(value:unknown): PropertyLayoutPreferences {
  const input = value as PropertyLayoutPreferences | null;
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(input,'order') || !Object.hasOwn(input,'visibility') || Object.keys(input).some(key => key !== 'order' && key !== 'visibility')
    || !Array.isArray(input.order) || ![...input.order].every(validPropertyKey) || new Set(input.order).size !== input.order.length
    || !input.visibility || typeof input.visibility !== 'object' || Array.isArray(input.visibility)
    || !Object.entries(input.visibility).every(([key,mode]) => validPropertyKey(key) && ['always','hide-empty','hidden'].includes(mode))) {
    throw new Error('属性布局配置无效。');
  }
  return {order:[...input.order],visibility:Object.fromEntries(Object.entries(input.visibility).sort(([left],[right]) => left < right ? -1 : left > right ? 1 : 0))};
}

export function parsePropertyLayout(raw:string): PropertyLayoutPreferences {
  return validatePropertyLayout(raw ? JSON.parse(raw) : {order:[],visibility:{}});
}

export function orderProperties<T>(rows:readonly T[], order:readonly string[], key:(row:T)=>string): T[] {
  const positions = new Map(order.map((value,index) => [value,index]));
  return rows.map((row,index) => ({row,index,position:positions.get(key(row)) ?? Infinity}))
    .sort((left,right) => left.position - right.position || left.index - right.index).map(({row}) => row);
}

export function isPropertyEmpty(value:unknown): boolean {
  return value == null || typeof value === 'string' && !value.trim() || Array.isArray(value) && value.length === 0;
}

export function propertyVisibility(layout:Pick<PropertyLayoutPreferences,'visibility'>, key:string): PropertyVisibility {
  return layout.visibility[key] ?? 'always';
}

export function isPropertyVisible(layout:Pick<PropertyLayoutPreferences,'visibility'>, key:string, value:unknown): boolean {
  const mode = propertyVisibility(layout,key);
  return mode === 'always' || mode === 'hide-empty' && !isPropertyEmpty(value);
}
