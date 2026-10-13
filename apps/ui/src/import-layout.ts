export const calloutColors = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export function imageColumns(value: unknown): number[] | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?){1,2}$/.test(value)) return null;
  const columns = value.split(',').map(Number);
  return columns.every(column => column > 0 && column <= 100) ? columns : null;
}

export function calloutColor(value: unknown): string | null {
  return typeof value === 'string' && calloutColors.includes(value) ? value : null;
}
