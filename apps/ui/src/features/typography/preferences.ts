import { FONT_VALUES, type FontChoice } from '@/lib/font-options';
import { FONT_GROUPS } from '@/lib/font-groups';

export const STORAGE_KEY = 'memocard.typography.v1';
const fonts = FONT_VALUES.filter(font => !['playfair-display', 'eb-garamond', 'pingfang', 'songti'].includes(font));
export const measurePresets: Record<string, { label: string; factor: number }> = {
  '60': { label: '窄', factor: 28 },
  '70': { label: '适中', factor: 33 },
  '80': { label: '宽', factor: 37 },
  '90': { label: '宽松', factor: 45 },
};
export const options = {
  measure: Object.keys(measurePresets),
  heading: ['inherit', ...fonts],
  body: fonts,
  mono: FONT_GROUPS.find(group => group.label === 'Mono')!.options.map(font => font.value),
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
      // Keep existing code-font preferences; new choices and randomization use only Mono fonts.
      const accepted = key === 'mono' ? fonts : options[key];
      if (typeof candidate === 'string' && (accepted as readonly string[]).includes(candidate)) Object.assign(result, { [key]: candidate });
    }
  } catch { /* Invalid local preferences use defaults. */ }
  return result;
}
