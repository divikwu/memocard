import type { Note } from "@memocard/contracts";

export function recentNoteTags(notes: readonly Note[]): string[] {
  const latest = new Map<string, number>();
  for (const note of notes) {
    if (note.deletedAt || !note.tags.length) continue;
    const updatedAt = Date.parse(note.updatedAt);
    for (const tag of note.tags) {
      if (updatedAt > (latest.get(tag) ?? -Infinity)) latest.set(tag, updatedAt);
    }
  }
  return [...latest]
    .sort(([a, aTime], [b, bTime]) => bTime - aTime || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, 16)
    .map(([tag]) => tag);
}
