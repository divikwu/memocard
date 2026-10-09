import { expect, it } from 'vitest';
import { inlineTags } from './inline-tags';
import { encodeObsidianNote, parseObsidianNote } from './browser-files';
it('recognizes explicit nested tags without interpreting Markdown syntax or invalid paths', () => {
  expect(inlineTags('# 标题\n正文 #工作/项目 #设计 #设计 #123 #/bad #bad/ #a//b C# \\#escaped')).toEqual(['工作/项目', '设计']);
  expect(inlineTags('`#code`\n```md\n#fenced\n```\n    #indented\n[链接](#anchor) [#label](url) [[#wiki]] <span title="#html">x</span> $x #math$\n#保留')).toEqual(['保留']);
  expect(inlineTags('```\n#unfinished')).toEqual([]);
});
it('ignores independent YAML tags even when the last body occurrence is deleted', async () => {
  const source = '---\ntags: [工作, legacy]\n---\n#工作';
  const parsed = await parseObsidianNote(new TextEncoder().encode(source), 'notes/a.md', 'vault', { id: 'a', path: 'notes/a.md', hash: '', createdAt: '' }, 0);
  expect(parsed.note.tags).toEqual(['工作']);
  const result = new TextDecoder().decode(encodeObsidianNote(parsed, '已删除正文标签'));
  const reopened = await parseObsidianNote(new TextEncoder().encode(result), 'notes/a.md', 'vault', { id: 'a', path: 'notes/a.md', hash: '', createdAt: '' }, 0);
  expect(reopened.note.tags).toEqual([]);
  expect(result).toContain('工作');
  expect(result).toContain('legacy');
  expect(result).not.toContain('#工作');
});
it('stores a separate title while preserving Markdown and unrelated YAML bytes', async () => {
 const source = '---\r\n# Keep comment\r\ntitle: Old\r\ncustom: "unchanged"\r\n---\r\n# Body heading\r\n\r\nText';
 const parsed = await parseObsidianNote(new TextEncoder().encode(source), 'a.md', 'vault', { id: 'a', path: 'a.md', hash: '', createdAt: '' }, 0);
 expect(parsed.note.title).toBe('Old');
 const encoded = new TextDecoder().decode(encodeObsidianNote(parsed, parsed.note.body, 'New'));
 expect(encoded).toBe(source.replace('title: Old', 'title: "New"'));
 expect(new TextDecoder().decode(encodeObsidianNote(parsed, parsed.note.body))).toBe(source);
});
