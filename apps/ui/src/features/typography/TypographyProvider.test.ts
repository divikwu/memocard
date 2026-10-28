import { expect, it } from 'vitest';
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
      '--note-size': size === '15' ? '0.9375rem' : size === '14' ? 'var(--font-size-sm)' : size === '18' ? 'var(--font-size-lg)' : 'var(--font-size-base)',
      '--note-summary-size': Number(size) > 16 ? 'var(--font-size-base)' : 'var(--font-size-sm)',
      '--note-scale': `${Number(size) / 16}`,
      '--note-leading': leading,
      '--note-flow': flow,
      '--note-measure': `${Number(size) * factors[measure]}px`,
    });
  }
});

it('ignores retired font preferences while retaining saved reading layout', () => {
  const layout = { measure: '60', size: '18', leading: '1.9', flow: '2em' };
  expect(parseTypography(JSON.stringify({ ...layout, heading: 'lora', body: 'noto-sans-sc', mono: 'jetbrains-mono' }))).toEqual(layout);
  expect(Object.keys(options)).toEqual(['measure', 'size', 'leading', 'flow']);
});
