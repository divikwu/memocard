import { expect, it } from 'vitest';
import { resolveTypography } from './TypographyProvider';
import { defaults, measurePresets, options, parseTypography } from './preferences';

it('keeps the two sizes independent of reading width and retains custom rhythm choices', () => {
  // These factors are the compatibility baseline, independent of the shared preset definitions.
  const factors: Record<string, number> = { '60': 28, '70': 33, '80': 37, '90': 45 };
  const relativeGaps: Record<string, Record<string, string>> = {
    '14': { '1em': '0.875rem', '1.25em': '1.09375rem', '2em': '1.75rem' },
    '16': { '1em': '1rem', '1.25em': '1.25rem', '2em': '2rem' },
  };
  const lines: Record<string, Record<string, number>> = {
    '14': { '1.5': 22, '1.6': 24, '1.75': 26, '1.9': 28 },
    '16': { '1.5': 24, '1.6': 26, '1.75': 28, '1.9': 30 },
  };
  const headings: Record<string, string[]> = {
    '14': ['1.625rem', '2.125rem', '1.375rem', '1.75rem', '1.125rem', '1.5rem'],
    '16': ['1.875rem', '2.5rem', '1.5rem', '2rem', '1.25rem', '1.625rem'],
  };
  expect(options.measure).toEqual(Object.keys(factors));
  expect(Object.values(measurePresets).map(preset => preset.label)).toEqual(['窄', '适中', '宽', '宽松']);
  for (const size of options.size) for (const leading of options.leading) for (const flow of options.flow) for (const measure of options.measure) {
    const value = parseTypography(JSON.stringify({ ...defaults, size, leading, flow, measure }));
    expect(resolveTypography(value)).toEqual({
      '--note-size': size === '14' ? 'var(--font-size-sm)' : 'var(--font-size-base)',
      '--note-summary-size': 'var(--font-size-sm)',
      '--note-h1-size': headings[size][0],
      '--note-h1-line-height': headings[size][1],
      '--note-h2-size': headings[size][2],
      '--note-h2-line-height': headings[size][3],
      '--note-h3-size': headings[size][4],
      '--note-h3-line-height': headings[size][5],
      '--note-leading': `${lines[size][leading] / Number(size)}`,
      '--note-line-height': `${lines[size][leading] / 16}rem`,
      '--note-flow': relativeGaps[size][flow] ?? flow,
      '--note-measure': `${16 * factors[measure]}px`,
    });
  }
});

it('ignores retired font preferences while retaining saved reading layout', () => {
  const layout = { measure: '60', size: '16', leading: '1.9', flow: '2em' };
  expect(parseTypography(JSON.stringify({ ...layout, heading: 'lora', body: 'noto-sans-sc', mono: 'jetbrains-mono' }))).toEqual(layout);
  expect(Object.keys(options)).toEqual(['measure', 'size', 'leading', 'flow']);
});

it.each(['15', '18'])('migrates retired size %s to 16 without changing saved custom layout', size => {
  expect(options.size).toEqual(['14', '16']);
  expect(parseTypography(JSON.stringify({size, measure:'70', leading:'1.75', flow:'2em'}))).toEqual({size:'16',measure:'70',leading:'1.75',flow:'2em'});
});
it('uses the Notion reference rhythm for new or reset preferences', () => {
  expect(parseTypography(null)).toEqual({measure:'90',size:'16',leading:'1.5',flow:'16px'});
  expect(parseTypography('invalid')).toEqual(defaults);
});
