// The first preview allows for the four system rows and three custom properties.
const defaultNotePropertyPreviewRows = 7;

const rowCounts = new Map<string, number>();

export function notePropertyPreviewKey(vault: string | null | undefined, note: string | undefined, hash: string | undefined) {
  return vault && note && hash ? JSON.stringify([vault, note, hash]) : undefined;
}

export function readNotePropertyPreviewRows(key: string | undefined) {
  return key ? rowCounts.get(key) : undefined;
}

export function noteDetailPropertyPreviewRows(key: string | undefined) {
  // Limit the number of visible placeholders for unusually long property lists.
  return Math.min(readNotePropertyPreviewRows(key) ?? defaultNotePropertyPreviewRows, 8);
}

export function rememberNotePropertyPreviewRows(key: string, count: number) {
  rowCounts.delete(key);
  rowCounts.set(key, count);
  if (rowCounts.size > 64) rowCounts.delete(rowCounts.keys().next().value!);
}

export function clearNotePropertyPreviewRows() {
  rowCounts.clear();
}
