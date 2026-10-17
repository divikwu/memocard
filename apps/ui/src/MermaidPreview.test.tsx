// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MermaidPreview } from './MermaidPreview';
import { mermaidSVG } from './mermaid-svg';
import { Markdown } from './markdown';

afterEach(cleanup);
const diagram = () => screen.getAllByRole('img', { name: 'Mermaid 图表' })[0].shadowRoot!;

it.each([
  ['flowchart', 'flowchart TD\nA[开始] --> B[完成]', '开始'],
  ['state', 'stateDiagram-v2\n[*] --> Idle\nIdle --> Done', 'Idle'],
  ['sequence', 'sequenceDiagram\nAlice->>Bob: Hello', 'Hello'],
  ['class', 'classDiagram\nAnimal <|-- Duck', 'Duck'],
  ['ER', 'erDiagram\nCUSTOMER ||--o{ ORDER : places', 'CUSTOMER'],
  ['XY', 'xychart-beta\nx-axis [Jan, Feb]\ny-axis 0 --> 10\nbar [3, 7]', 'Jan'],
])('renders %s locally with scoped theme styles and no font requests', async (_name, source, label) => {
  render(<MermaidPreview source={source} />);
  await screen.findByRole('button', { name: '放大 Mermaid 图表' }, { timeout: 15000 });
  await waitFor(() => expect(diagram()?.querySelector('svg')).toBeTruthy());
  expect(diagram().textContent).toContain(label);
  expect(diagram().textContent).not.toContain('@import');
  expect(diagram().textContent).not.toContain('display=swap');
  expect(diagram().querySelector('svg')?.getAttribute('style')).toContain('var(--foreground)');
  expect(diagram().querySelector('svg')?.getAttribute('style')).toContain('--accent:var(--foreground)');
  expect(diagram().querySelector('svg')?.getAttribute('style')).toContain('--muted:var(--muted-foreground)');
});

it('replaces the preview after editing and recovers after invalid syntax', async () => {
  const page=render(<MermaidPreview source={'flowchart TD\nA[旧文字] --> B'} />);
  await screen.findByRole('button', { name: '放大 Mermaid 图表' });
  page.rerender(<MermaidPreview source={'pie\n"A" : 1'} />);
  expect(screen.queryByRole('button', { name: '放大 Mermaid 图表' })).toBeNull();
  expect((await screen.findByRole('alert')).textContent).toContain('源码已保留');
  page.rerender(<MermaidPreview source={'flowchart TD\nA[新文字] --> B'} />);
  await screen.findByRole('button', { name: '放大 Mermaid 图表' });
  await waitFor(() => {
    expect(diagram()?.textContent).toContain('新文字');
    expect(diagram()?.textContent).not.toContain('旧文字');
  });
});
it('previews fenced Mermaid in the read renderer without converting ordinary code', async () => {
  render(<Markdown body={'```mermaid\nflowchart TD\nA[阅读预览] --> B\n```\n\n```typescript\nconst n = 1;\n```'} />);
  await screen.findByRole('button', { name: '放大 Mermaid 图表' });
  await waitFor(() => expect(diagram()?.textContent).toContain('阅读预览'));
  expect(document.querySelector('pre code.language-mermaid')?.textContent).toContain('flowchart TD');
  expect(document.querySelector('pre code.language-typescript')?.textContent).toContain('const n = 1;');
  expect(screen.getAllByRole('button', { name: '放大 Mermaid 图表' })).toHaveLength(1);
  const source = document.querySelector('code.language-mermaid')!;
  fireEvent.click(screen.getByRole('tab', { name: '仅图形' }));
  expect(source.closest<HTMLElement>('.mermaid-source')!.hidden).toBe(true);
  expect(screen.getByRole('tab', { name: '仅图形' }).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: '仅源码' }));
  expect(screen.queryByRole('img', { name: 'Mermaid 图表' })).toBeNull();
  expect(source.closest<HTMLElement>('.mermaid-source')!.hidden).toBe(false);
  fireEvent.click(screen.getByRole('tab', { name: '源码与图形' }));
  expect(screen.getByRole('img', { name: 'Mermaid 图表' })).toBeTruthy();
  expect(document.querySelector('code.language-mermaid')).toBe(source);
});

it('switches individual Mermaid blocks independently and keeps errors accessible in diagram mode', async () => {
  render(<Markdown body={'```mermaid\nflowchart TD\nA --> B\n```\n\n```mermaid\npie\n"A" : 1\n```'} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getAllByRole('tab', { name: '仅图形' })[1]);
  expect(screen.getByRole('alert').textContent).toContain('源码已保留');
  expect(screen.getAllByRole('tab', { name: '源码与图形' })[0].getAttribute('aria-selected')).toBe('true');
  expect(document.querySelectorAll<HTMLElement>('.mermaid-source')[0].hidden).toBe(false);
  expect(document.querySelectorAll<HTMLElement>('.mermaid-source')[1].hidden).toBe(true);
});

it('opens the existing Dialog and closes with Escape or blank space', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  render(<MermaidPreview source={'flowchart TD\nA --> B'} />);
  fireEvent.click(await screen.findByRole('button', { name: '放大 Mermaid 图表' }));
  const popup=await screen.findByRole('dialog', { name: 'Mermaid 图表' });
  expect(screen.getByRole('button', { name: '关闭图表' })).toBeTruthy();
  fireEvent.keyDown(popup, { key: 'Escape' });
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '放大 Mermaid 图表' }));
  fireEvent.click(await screen.findByRole('dialog'));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  vi.unstubAllGlobals();
});

it('removes active elements, external resources and font imports from generated SVG', () => {
  const clean=mermaidSVG('<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://example.com/font); svg{color:red}</style><script>alert(1)</script><foreignObject><div>HTML</div></foreignObject><rect onload="bad()" fill="url(https://example.com/x)"/><path marker-end="url(#arrow)"/><text>&lt;script&gt;标签&lt;/script&gt;</text></svg>');
  expect(clean).not.toMatch(/@import|<script|<foreignObject|onload|https?:\/\/example/);
  expect(clean).toContain('url(#arrow)');
  expect(clean).toContain('&lt;script&gt;标签&lt;/script&gt;');
});
