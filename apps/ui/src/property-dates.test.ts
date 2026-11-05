import { expect, it } from 'vitest';
import { validPropertyDate, formatPropertyDate } from './property-dates';

it.each([
  ['2028-02-29', '02/29/2028'],
  ['2026-10-13T09:30:42.123+08:00', '10/13/2026'],
  ['2026-10-13T01:30:42.123Z', '10/13/2026'],
  ['2026-10-13T09:30-04:00', '10/13/2026'],
])('displays only the date even when the value includes time: %s', (value, expected) => {
  expect(validPropertyDate(value)).toBe(true);
  expect(formatPropertyDate(value)).toBe(expected);
});
it.each(['2026-02-30','2026-02-30T09:30:00Z','2026-10-13T24:00:00Z','2026-10-13T09:60:00Z','2026-10-13T09:30:60Z','2026-10-13T09:30:00+24:00','2026-10-13T09:30:00','not a date'])('rejects an invalid date/time: %s', value => {
  expect(validPropertyDate(value)).toBe(false);
});
