import { FONT_VALUES, type FontChoice } from '@/lib/font-options';

export const STORAGE_KEY = 'memocard.typography.v1';
const fonts = FONT_VALUES.filter(font => !['playfair-display', 'eb-garamond', 'pingfang', 'songti'].includes(font));
export const options = {
  measure: ['60', '70', '80', '90'],
  heading: ['inherit', ...fonts],
  body: fonts,
  mono: fonts,
  size: ['14', '15', '16', '18'],
  leading: ['1.6', '1.75', '1.9'],
  flow: ['1em', '1.25em', '2em'],
};
export type Typography = { measure: string; heading: FontChoice | 'inherit'; body: FontChoice; mono: FontChoice; size: string; leading: string; flow: string };
export const defaults: Typography = { measure: '90', heading: 'inherit', body: 'noto-sans', mono: 'geist-mono', size: '16', leading: '1.6', flow: '1em' };
export function parseTypography(raw: string | null): Typography {
  const result = { ...defaults };
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const key of Object.keys(options) as (keyof Typography)[]) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === 'string' && (options[key] as readonly string[]).includes(candidate)) Object.assign(result, { [key]: candidate });
    }
  } catch { /* Invalid local preferences use defaults. */ }
  return result;
}
