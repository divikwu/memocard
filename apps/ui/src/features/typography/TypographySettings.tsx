import { RotateCcw, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { defaults, measurePresets, options, type Typography } from './preferences';
import { FONT_GROUPS } from '@/lib/font-groups';
import { useTypography } from './TypographyProvider';
import { Markdown } from '@/markdown';
const fonts = FONT_GROUPS.flatMap(group => group.options).filter(font => options.body.includes(font.value));
const labels: Record<keyof Typography, string> = { measure: '行宽', heading: '笔记标题字体', body: '笔记正文字体', mono: '笔记等宽字体', size: '字号', leading: '行高', flow: '段落间距' };
const names: Record<string, string> = { inherit: '跟随正文', '1.6': '紧凑（1.6）', '1.75': '标准（1.75）', '1.9': '宽松（1.9）', '1em': '紧凑（1em）', '1.25em': '标准（1.25em）', '2em': '宽松（2em）', ...Object.fromEntries(fonts.map(font => [font.value, font.label])) };
const label = (key: keyof Typography, value: string) => key === 'measure' ? measurePresets[value].label : key === 'size' ? `${value}px 基准` : names[value] ?? value;
const preview = `# 把一闪而过的想法留下来

早晨走过熟悉的街道，忽然想到一个新的点子。打开 MemoCard，先把它记下来，再慢慢整理。好的记录不必完整，能留住当时的思路就够了。

Keep a little room for new ideas. 中文与 English 自然地出现在同一段里，让阅读保持流畅，也让每一次回顾都轻松一些。

## 从一个小想法开始

- 记下今天的**发现**，也留下一点疑问。
- 用 \`#灵感\` 串起相关笔记，等有空时继续展开。

> 不急着找到答案，先给想法一个可以停留的地方。`;
export function TypographySettings() {
  const { value, save, error } = useTypography();
  return <section aria-labelledby="typography-heading" className="space-y-3">
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2"><h2 id="typography-heading" className="text-balance text-base font-medium">内容风格</h2><div className="ml-auto flex gap-1"><Button size="sm" variant="ghost" className="shrink-0 text-secondary" onClick={() => { const next = { ...value }; for (const key of Object.keys(options) as (keyof Typography)[]) Object.assign(next, { [key]: options[key][Math.floor(Math.random() * options[key].length)] }); save(next); }}><Shuffle aria-hidden="true" />随机搭配</Button><Button size="sm" variant="ghost" className="shrink-0 text-secondary" onClick={() => save({ ...defaults })}><RotateCcw aria-hidden="true" />恢复默认风格</Button></div></div>
    <p className="text-pretty text-sm text-secondary">用于笔记正文和编辑区域，不改变导航与工具栏。保存在当前设备的浏览器中。字号按 16px 根字号标注基准值，实际文字随浏览器缩放。</p>
    {error && <p role="status" className="text-sm text-error">{error}</p>}
    <Card className="gap-0 py-0 shadow-none"><CardContent className="divide-y divide-border/60 px-4">{(Object.keys(options) as (keyof Typography)[]).map(key => <div key={key} className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-6"><span className="min-w-0 text-sm">{labels[key]}</span><Select value={value[key]} onValueChange={next => { if (next) save({ ...value, [key]: next }); }}><SelectTrigger aria-label={labels[key]} className="w-full shrink-0 shadow-none sm:w-48"><SelectValue>{label(key, value[key])}</SelectValue></SelectTrigger><SelectContent align="end" className="max-h-80">{key === 'mono' && !options.mono.includes(value.mono) && <SelectItem value={value.mono}>{label(key, value.mono)}（已有设置）</SelectItem>}{options[key].map(option => <SelectItem key={option} value={option}>{label(key, option)}</SelectItem>)}</SelectContent></Select></div>)}</CardContent></Card>
    <div role="region" aria-label="笔记排版预览" className="overflow-hidden rounded-xl border bg-body">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <p className="text-sm font-medium">实时预览</p>
        <p className="type-supporting text-secondary">随内容风格设置即时更新</p>
      </div>
      <div className="px-5 py-6 sm:p-8">
        <div className="mx-auto w-full max-w-(--note-measure)"><Markdown body={preview} /></div>
      </div>
    </div>
  </section>;
}
