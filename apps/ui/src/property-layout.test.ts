import { expect, it } from 'vitest';
import { isPropertyEmpty, isPropertyVisible, orderProperties, parsePropertyLayout, propertyVisibility, validatePropertyLayout, validPropertyKey } from './property-layout';

it('reads an empty configuration and keeps namespaced unknown fields for other notes', () => {
  expect(parsePropertyLayout('')).toEqual({order:[],visibility:{}});
  const value={order:['property:unseen','system:tags','property:__proto__'],visibility:{'property:unseen':'hidden','property:__proto__':'hide-empty','system:tags':'always'}};
  expect(parsePropertyLayout(JSON.stringify(value))).toEqual(value);
  expect(Object.getPrototypeOf(parsePropertyLayout(JSON.stringify(value)).visibility)).toBe(Object.prototype);
});

it.each([
  'null', '[]', '{}', '{broken', '{"order":[],"visibility":{},"extra":true}',
  '{"order":["system:unknown"],"visibility":{}}', '{"order":["property:"],"visibility":{}}',
  '{"order":["system:tags","system:tags"],"visibility":{}}',
  '{"order":[],"visibility":{"__proto__":"hidden"}}',
  '{"order":[],"visibility":{"constructor":"always"}}',
  '{"order":[],"visibility":{"property:title":"never"}}',
  '{"order":[],"visibility":{"property:title":false}}',
  '{"order":[],"visibility":[]}', '{"order":[null],"visibility":{}}',
])('rejects malformed or unsafe property layout configuration: %s', raw => {
  expect(() => parsePropertyLayout(raw)).toThrow();
});

it('validates transport values without accepting inherited required fields or sparse order entries', () => {
  expect(() => validatePropertyLayout(Object.create({order:[],visibility:{}}))).toThrow();
  expect(() => validatePropertyLayout({order:new Array(1),visibility:{}})).toThrow();
  for (const key of [' property:title','property:title ','property:a\nline','property:a\u007fline','__proto__']) expect(validPropertyKey(key)).toBe(false);
  expect(validPropertyKey(`property:${'长名称'.repeat(100)}`)).toBe(true);
});

it('sorts known rows stably while retaining natural order for newly introduced properties', () => {
  const rows=[{key:'property:first'},{key:'system:tags'},{key:'property:new'},{key:'system:updatedAt'}];
  expect(orderProperties(rows,['property:unseen','system:updatedAt','system:tags'],row=>row.key)).toEqual([rows[3],rows[1],rows[0],rows[2]]);
  expect(rows.map(row=>row.key)).toEqual(['property:first','system:tags','property:new','system:updatedAt']);
});

it('hides only empty values and always-hidden fields, preserving false and zero', () => {
  const layout={order:[],visibility:{'property:conditional':'hide-empty','property:private':'hidden'}} as const;
  for (const value of ['', ' \n ', null, undefined, []]) expect(isPropertyEmpty(value)).toBe(true);
  for (const value of [false, 0, '0', ['value'], {}]) {
    expect(isPropertyEmpty(value)).toBe(false);
    expect(isPropertyVisible(layout,'property:conditional',value)).toBe(true);
  }
  expect(isPropertyVisible(layout,'property:conditional','')).toBe(false);
  expect(isPropertyVisible(layout,'property:private','nonempty')).toBe(false);
  expect(isPropertyVisible(layout,'property:unconfigured','')).toBe(true);
  expect(propertyVisibility(layout,'property:unconfigured')).toBe('always');
});
