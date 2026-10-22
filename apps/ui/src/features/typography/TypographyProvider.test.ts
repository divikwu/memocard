import { expect, it } from 'vitest';
import { FONT_FAMILIES } from '@/lib/font-options';
import { resolveTypography } from './TypographyProvider';
import { defaults, measurePresets, options, parseTypography } from './preferences';

it('preserves every existing size, leading, flow and reading-width combination', () => {
  // These factors are the compatibility baseline, independent of the shared preset definitions.
  const factors: Record<string, number> = { '60': 28, '70': 33, '80': 37, '90': 45 };
  expect(options.measure).toEqual(Object.keys(factors));
  expect(Object.values(measurePresets).map(preset => preset.label)).toEqual(['窄', '适中', '宽', '宽松']);
  for (const size of options.size) for (const leading of options.leading) for (const flow of options.flow) for (const measure of options.measure) {
    const value = parseTypography(JSON.stringify({ ...defaults, size, leading, flow, measure }));
    expect(resolveTypography(value)).toEqual({
      '--note-body-font': FONT_FAMILIES['noto-sans'],
      '--note-heading-font': FONT_FAMILIES['noto-sans'],
      '--note-mono-font': FONT_FAMILIES['geist-mono'],
      '--note-size': size === '15' ? '0.9375rem' : size === '14' ? 'var(--font-size-sm)' : size === '18' ? 'var(--font-size-lg)' : 'var(--font-size-base)',
      '--note-scale': `${Number(size) / 16}`,
      '--note-summary-size': Number(size) > 16 ? 'var(--font-size-base)' : 'var(--font-size-sm)',
      '--note-leading': leading,
      '--note-flow': flow,
      '--note-measure': `${Number(size) * factors[measure]}px`,
    });
  }
});

it('resolves all allowed font roles and retains legacy code-font preferences', () => {
  for (const body of options.body) {
    expect(resolveTypography({ ...defaults, body })['--note-heading-font']).toBe(FONT_FAMILIES[body]);
    expect(resolveTypography({ ...defaults, body })['--note-body-font']).toBe(FONT_FAMILIES[body]);
    const legacy = parseTypography(JSON.stringify({ ...defaults, mono: body }));
    expect(resolveTypography(legacy)['--note-mono-font']).toBe(FONT_FAMILIES[body]);
  }
  for (const heading of options.body) expect(resolveTypography({ ...defaults, heading })['--note-heading-font']).toBe(FONT_FAMILIES[heading]);
  for (const mono of options.mono) expect(resolveTypography({ ...defaults, mono })['--note-mono-font']).toBe(FONT_FAMILIES[mono]);
});
