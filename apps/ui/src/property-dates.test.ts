import { expect, it } from 'vitest';
import { validPropertyDate, propertyDateTime, formatPropertyDate } from './property-dates';

it.each(['2028-02-29','2026-10-13T09:30:42.123+08:00','2026-10-13T01:30:42.123Z','2026-10-13T09:30-04:00'])('accepts and preserves a date with optional time: %s', value => {
  expect(validPropertyDate(value)).toBe(true);
  expect(formatPropertyDate(value)).toContain('2026' === value.slice(0,4) ? '10/13/2026' : '02/29/2028');
});
it.each(['2026-02-30','2026-02-30T09:30:00Z','2026-10-13T24:00:00Z','2026-10-13T09:60:00Z','2026-10-13T09:30:60Z','2026-10-13T09:30:00+24:00','2026-10-13T09:30:00','not a date'])('rejects an invalid date/time: %s', value => {
  expect(validPropertyDate(value)).toBe(false);
});
it('keeps seconds, fractional seconds and the stored offset when choosing another day',()=>{
  expect(propertyDateTime('2026-11-05','09:30:42.123','2026-10-13T09:30:42.123+08:00')).toBe('2026-11-05T09:30:42.123+08:00');
  expect(propertyDateTime('2026-11-05','09:30','2026-10-13T09:30:00Z')).toBe('2026-11-05T09:30:00Z');
});
