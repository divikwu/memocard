export const STORAGE_KEY = 'memocard.typography.v1';
export const measurePresets: Record<string, { label: string; factor: number }> = {
  '60': { label: '窄', factor: 28 },
  '70': { label: '适中', factor: 33 },
  '80': { label: '宽', factor: 37 },
  '90': { label: '宽松', factor: 45 },
};
export const options = {
  measure: Object.keys(measurePresets),
  size: ['14', '15', '16', '18'],
  leading: ['1.6', '1.75', '1.9'],
  flow: ['1em', '1.25em', '2em'],
};
export type Typography = { measure: string; size: string; leading: string; flow: string };
export const defaults: Typography = { measure: '90', size: '16', leading: '1.6', flow: '1em' };
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
