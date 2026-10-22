// One active size scale. Values are rem; px values are the 16px root baseline.
export const REFERENCE_ROOT_SIZE = 16;
export const fontSizes = { xs: .75, sm: .875, base: 1, lg: 1.125, xl: 1.25, '2xl': 1.5, '3xl': 2 } as const;
export const fontWeights = { normal: 400, medium: 500, semibold: 600 } as const;
export const lineHeights = { tight: 1.25, normal: 1.5, relaxed: 1.75 } as const;
export type FontSize = keyof typeof fontSizes;
export type Leading = keyof typeof lineHeights;
export const textStyles = {
  title: { size: '3xl', weight: 'semibold', leading: 'tight' },
  heading: { size: '2xl', weight: 'semibold', leading: 'tight' },
  subheading: { size: 'xl', weight: 'semibold', leading: 'tight' },
  large: { size: 'lg', weight: 'semibold', leading: 'normal' },
  body: { size: 'base', weight: 'normal', leading: 'normal' },
  label: { size: 'sm', weight: 'medium', leading: 'normal' },
  supporting: { size: 'xs', weight: 'normal', leading: 'normal' },
  code: { size: 'sm', weight: 'normal', leading: 'normal' },
} as const satisfies Record<string, { size: FontSize; weight: keyof typeof fontWeights; leading: Leading }>;

// Snap a strategy's target to a 4px grid, with at least 4px of breathing room.
export function lineHeight(size: FontSize, leading: Leading = 'normal') {
  const pixels = fontSizes[size] * REFERENCE_ROOT_SIZE;
  const height = Math.max(Math.round(pixels * lineHeights[leading] / 4) * 4, Math.ceil((pixels + 4) / 4) * 4);
  return { pixels: height, ratio: Math.round(height / pixels * 10000) / 10000 };
}
