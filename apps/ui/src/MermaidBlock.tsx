import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Code, GitBranch, PanelsTopLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MermaidPreview = lazy(() => import('./MermaidPreview').then(module => ({ default: module.MermaidPreview })));
const modes = [
  { value: 'source', label: '仅源码', icon: Code },
  { value: 'preview', label: '仅图形', icon: GitBranch },
  { value: 'both', label: '源码与图形', icon: PanelsTopLeft },
] as const;

export function MermaidBlock({ source, children }: { source: string; children: ReactNode }) {
  const [mode, setMode] = useState<'source' | 'preview' | 'both'>('both');
  return <Tabs className="mermaid-block" value={mode} onValueChange={value => setMode(value as typeof mode)}>
    <div className="mermaid-toolbar" contentEditable={false}>
      <TabsList aria-label="Mermaid 显示模式">
        {modes.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} aria-label={label} title={label}><Icon aria-hidden="true" /></TabsTrigger>)}
      </TabsList>
    </div>
    <TabsContent className="mermaid-content" value={mode} keepMounted>
      <div className="mermaid-source" hidden={mode === 'preview'}>{children}</div>
      <div hidden={mode === 'source'}>
        <Suspense fallback={<p role="status">正在生成图表预览…</p>}><MermaidPreview source={source} /></Suspense>
      </div>
    </TabsContent>
  </Tabs>;
}
