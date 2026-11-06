// CSS rem values and native logical points share this reference root size.
export const REFERENCE_ROOT_SIZE = 16;
export const STANDARD_PARAGRAPH_GAP = 8;

export function noteParagraphGap(size: string, flow: string): number {
  const gap = parseFloat(flow);
  return flow.endsWith('em') ? Math.round(gap * Number(size) / 2) * 2 : gap;
}

// Existing leading values remain storage keys; rendered metrics use even-pixel steps.
export const noteLineHeights: Record<string, Record<string, number>> = {
  '14': { '1.5': 22, '1.6': 24, '1.75': 26, '1.9': 28 },
  '16': { '1.5': 24, '1.6': 26, '1.75': 28, '1.9': 30 },
};
export const noteHeadings: Record<string, readonly (readonly [number, number])[]> = {
  '14': [[26, 34], [22, 28], [18, 24], [16, 24]],
  '16': [[32, 40], [26, 34], [22, 28], [18, 24]],
};
