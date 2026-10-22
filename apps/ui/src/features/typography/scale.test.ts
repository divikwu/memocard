import { expect, it } from 'vitest';
import { fontSizes, fontWeights, lineHeights, textStyles, lineHeight } from './scale';

it('keeps seven shared rem sizes, three weights, three leading strategies and eight complete styles', () => {
  expect(fontSizes).toEqual({ xs: .75, sm: .875, base: 1, lg: 1.125, xl: 1.25, '2xl': 1.5, '3xl': 2 });
  expect(fontWeights).toEqual({ normal: 400, medium: 500, semibold: 600 });
  expect(lineHeights).toEqual({ tight: 1.25, normal: 1.5, relaxed: 1.75 });
  expect(Object.keys(textStyles)).toEqual(['title', 'heading', 'subheading', 'large', 'body', 'label', 'supporting', 'code']);
  for (const style of Object.values(textStyles)) {
    expect(style.size in fontSizes).toBe(true);
    expect(style.weight in fontWeights).toBe(true);
    expect(style.leading in lineHeights).toBe(true);
  }
  expect(textStyles.title.weight).toBe('semibold');
});

it('derives readable grid-aligned line boxes for every size and strategy', () => {
  expect(Object.keys(fontSizes).map(size => lineHeight(size as keyof typeof fontSizes).pixels)).toEqual([20, 20, 24, 28, 32, 36, 48]);
  for (const size of Object.keys(fontSizes) as (keyof typeof fontSizes)[]) {
    for (const leading of Object.keys(lineHeights) as (keyof typeof lineHeights)[]) {
      const result = lineHeight(size, leading);
      expect(result.pixels % 4).toBe(0);
      expect(result.pixels).toBeGreaterThanOrEqual(fontSizes[size] * 16 + 4);
      expect(result.ratio * fontSizes[size] * 16).toBeCloseTo(result.pixels, 2);
    }
    expect(lineHeight(size, 'tight').pixels).toBeLessThanOrEqual(lineHeight(size, 'normal').pixels);
    expect(lineHeight(size, 'normal').pixels).toBeLessThanOrEqual(lineHeight(size, 'relaxed').pixels);
  }
  expect(Object.values(textStyles).map(style => lineHeight(style.size, style.leading).pixels)).toEqual([40, 32, 24, 28, 24, 20, 20, 20]);
});
