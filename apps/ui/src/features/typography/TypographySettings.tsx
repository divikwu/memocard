import { RotateCcw, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { defaults, fonts, options, type Typography } from './preferences';
import { useTypography } from './TypographyProvider';
import { Markdown } from '@/markdown';
const labels: Record<keyof Typography, string> = { measure: '行宽', heading: '笔记标题字体', body: '笔记正文字体', mono: '笔记等宽字体', size: '字号', leading: '行高', flow: '段落间距' };
const names: Record<string, string> = { inherit: '跟随正文', '1.6': '紧凑（1.6）', '1.75': '标准（1.75）', '1.9': '宽松（1.9）', '1em': '紧凑（1em）', '1.25em': '标准（1.25em）', '2em': '宽松（2em）', ...Object.fromEntries(fonts.map(font => [font.value, font.label])) };
const label = (key: keyof Typography, value: string) => key === 'measure' ? `${value}ch` : key === 'size' ? `${value}px` : names[value] ?? value;
export function TypographySettings() {
  const { value, save, error } = useTypography();
  return <section aria-labelledby="typography-heading" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="typography-heading" className="text-base font-medium">内容风格</h2><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => { const next = { ...value }; for (const key of Object.keys(options) as (keyof Typography)[]) Object.assign(next, { [key]: options[key][Math.floor(Math.random() * options[key].length)] }); save(next); }}><Shuffle aria-hidden="true" />随机搭配</Button><Button size="sm" variant="ghost" onClick={() => save({ ...defaults })}><RotateCcw aria-hidden="true" />恢复默认风格</Button></div></div>
    <p className="text-sm text-muted-foreground">用于笔记正文和编辑区域，不改变导航与工具栏。保存在当前设备的浏览器中。</p>
    {error && <p role="status" className="text-sm text-destructive">{error}</p>}
    <Card className="gap-0 py-0 shadow-none"><CardContent className="divide-y px-4">{(Object.keys(options) as (keyof Typography)[]).map(key => <div key={key} className="flex flex-wrap items-center justify-between gap-3 py-4"><span className="text-sm">{labels[key]}</span><Select value={value[key]} onValueChange={next => { if (next) save({ ...value, [key]: next }); }}><SelectTrigger aria-label={labels[key]} className="w-48 max-w-full"><SelectValue>{label(key, value[key])}</SelectValue></SelectTrigger><SelectContent className="max-h-72" position="popper">{options[key].map(option => <SelectItem key={option} value={option}>{label(key, option)}</SelectItem>)}</SelectContent></Select></div>)}</CardContent></Card>
    <div className="rounded-lg border p-5"><p className="mb-4 text-xs text-muted-foreground">实时预览</p><Markdown body={'## 让记录清晰易读\n\n中文与 English 使用同一套阅读节奏。支持 **重点**、*强调*、~~删除线~~ 和 `行内代码`。\n\n- 普通列表\n- [x] 已完成事项\n\n> 留下值得回顾的想法。\n\n| 内容 | 状态 |\n| --- | --- |\n| 排版配置 | 即时生效 |'} /></div>
  </section>;
}
