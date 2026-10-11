import { expect, it } from 'vitest';
import { namedNotePath, rewriteNoteLinks, safeNoteTitle } from './note-files';

it('uses safe readable names, case-insensitive collisions and bounded UTF-8 filenames', () => {
  expect(namedNotePath('notes/id.md', '记录', ['notes/记录.md', 'notes/记录 (2).md'])).toBe('notes/记录 (3).md');
  expect(namedNotePath('notes/id.md', 'Name', ['notes/name.md'])).toBe('notes/Name (2).md');
  expect(safeNoteTitle('../a:b/')).toBe('a b');
  expect(safeNoteTitle('CON')).toBe('_CON');
  expect(safeNoteTitle('')).toBe('未命名');
  expect(new TextEncoder().encode(safeNoteTitle('中文🌱'.repeat(100))).length).toBeLessThanOrEqual(200);
});

it('rewrites only resolved links, retaining YAML, code, aliases, fragments and ambiguous names', () => {
  const source = '---\ntitle: "[[Old]]"\n---\n[[Old#Heading|显示]] ![[Old]] [显示](../Old.md#part "title")\n[ref]: <../Old.md>\n`[[Old]]`\n```md\n[[Old]]\n```\n    [[Old]]\n<!-- [[Old]] -->\n---\n[[Old]]\n---\n[[Dup]]';
  const next = rewriteNoteLinks(source, 'folder/Source.md', ['Old.md', 'a/Dup.md', 'b/Dup.md'], { 'Old.md': '新 名.md', 'a/Dup.md': 'renamed.md' });
  expect(next).toBe(source.replace('[[Old#Heading|显示]] ![[Old]]', '[[新 名#Heading|显示]] ![[新 名]]').replace('../Old.md#part', '../%E6%96%B0%20%E5%90%8D.md#part').replace('<../Old.md>', '<../%E6%96%B0%20%E5%90%8D.md>').replace('---\n[[Old]]\n---', '---\n[[新 名]]\n---'));
});

it('does not replace the displayed text when it matches the destination', () => {
  expect(rewriteNoteLinks('[Old.md](Old.md)\n[Old.md]: Old.md', 'Source.md', ['Old.md'], { 'Old.md': 'New.md' })).toBe('[Old.md](New.md)\n[Old.md]: New.md');
});
