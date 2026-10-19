import { useEffect, useId, useRef, useState } from "react";
import { Pin } from "lucide-react";
import themeCSS from "../src/styles.css?raw";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { useTheme } from "../src/features/theme/ThemeProvider";
import { tagColors } from "../src/tag-colors";
import { measurePair } from "./foundation-color-contrast";
import "../src/tag-colors.css";

// Read role names from the production Tailwind mapping, without copying values.
const theme = themeCSS.match(/@theme inline \{([\s\S]*?)\n\}/)![1];
export const colorRoles = [...theme.matchAll(/--color-([\w-]+):\s*var\((--[\w-]+)\)/g)]
  .map(([, name, variable]) => ({ name, variable }));

type Pair = { id: string; foreground: string; background: string; source: string; backdrop?: string; label?: string; scope?: "non-text" | "diagnostic"; note?: string };
const semanticPairs: Pair[] = [
  { id: "page", foreground: "foreground", background: "background", source: "styles.css / App" },
  { id: "card", foreground: "card-foreground", background: "card", source: "components/ui/card.tsx" },
  { id: "popover", foreground: "popover-foreground", background: "popover", source: "components/ui/popover.tsx" },
  { id: "primary", foreground: "primary-foreground", background: "primary", source: "components/ui/button.tsx · default" },
  { id: "secondary", foreground: "secondary-foreground", background: "secondary", source: "components/ui/button.tsx · secondary" },
  { id: "muted-page", foreground: "muted-foreground", background: "background", source: "features/theme/ThemeSettings.tsx · 辅助说明" },
  { id: "muted-surface", foreground: "muted-foreground", background: "muted", source: "components/ui/tabs.tsx · TabsList", scope: "diagnostic", note: "容器角色；实际 Tab 文字另行覆写。本项仅诊断配对，不据此判断页面文字 AA。" },
  { id: "accent", foreground: "accent-foreground", background: "accent", source: "styles.css · 选中角色 / 搜索选中背景" },
  { id: "accent-text", foreground: "accent-text", background: "background", source: "components/note-pin-button.tsx", scope: "non-text", note: "当前用于已固定图标，采用非文本 3:1；不是文字色 AA 验收。" },
  { id: "destructive-text", foreground: "destructive", background: "background", source: "NoteProperties.tsx · 错误说明" },
  { id: "hover", foreground: "foreground", background: "hover-bg", source: "components/ui/button.tsx · outline hover" },
  { id: "sidebar", foreground: "sidebar-foreground", background: "sidebar", source: "components/ui/sidebar.tsx" },
  { id: "sidebar-selected", foreground: "sidebar-accent-foreground", background: "sidebar-accent", backdrop: "sidebar", source: "components/ui/sidebar.tsx · active" },
];
const tagPairs: Pair[] = tagColors.map(([id, label]) => ({ id: `tag-${id}`, label, foreground: `tag-${id}-fg`, background: `tag-${id}-bg`, source: "TagPill.tsx / tag-colors.css" }));
export const contrastPairs = [...semanticPairs, ...tagPairs];
type Measurement = ReturnType<typeof measurePair>;

function ProductionStates() {
  const id = useId();
  const [value, setValue] = useState("");
  return <section aria-label="真实组件状态" className="space-y-4 rounded-lg border p-4">
    <h2 className="text-lg font-semibold">真实组件状态</h2>
    <p className="text-sm">按钮可悬停或用 Tab 聚焦；禁用、校验错误和选中态直接来自生产组件。禁用控件不计入普通文字 AA 结论；键盘焦点验证可达性与样式存在，固定图标另按 3:1 测量。</p>
    <div className="flex flex-wrap gap-3"><Button variant="outline">悬停或聚焦此按钮</Button><Button disabled>暂不可用</Button></div>
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm">正常输入<Input aria-label="正常输入" value={value} onChange={event => setValue(event.target.value)} placeholder="输入一条笔记标题" /></label>
      <label className="space-y-2 text-sm">校验错误<Input aria-label="校验错误" aria-invalid="true" aria-describedby={`${id}-error`} defaultValue="尚未通过校验" /><span id={`${id}-error`} className="block text-destructive">请检查输入内容。</span></label>
    </div>
    <Tabs defaultValue="notes" className="max-w-xl">
      <TabsList aria-label="状态切换"><TabsTrigger value="notes">笔记</TabsTrigger><TabsTrigger value="pinned">已固定</TabsTrigger></TabsList>
      <TabsContent value="notes">当前查看笔记。</TabsContent><TabsContent value="pinned">当前查看已固定笔记。</TabsContent>
    </Tabs>
  </section>;
}

export function Colors() {
  const { theme, palette, neutralPalette } = useTheme();
  const samples = useRef(new Map<string, HTMLElement>());
  const [measurements, setMeasurements] = useState<Record<string, Measurement>>({});
  useEffect(() => {
    setMeasurements(Object.fromEntries(contrastPairs.map(pair => [pair.id, measurePair(samples.current.get(pair.id)!)])));
  }, [theme, palette, neutralPalette]);
  const failures = contrastPairs.filter(pair => !pair.scope && measurements[pair.id]?.ratio < 4.5).length;
  const diagnosticFailures = contrastPairs.filter(pair => pair.scope === "diagnostic" && measurements[pair.id]?.ratio < 4.5).length;
  const result = (pair: Pair, value: Measurement) => pair.scope === "diagnostic" ? `${value.ratio < 4.5 ? "低于" : "达到"} 4.5:1（容器配对诊断）`
    : pair.scope === "non-text" ? `图标 3:1 ${value.ratio >= 3 ? "通过" : "未达标（既有问题）"}`
    : value.ratio >= 4.5 ? "文字 AA 通过" : "文字 AA 未达标（既有问题）";
  const pairSample = (pair: Pair) => <div key={pair.id} className="space-y-2 rounded-lg border p-3" style={{ backgroundColor: "var(--background)" }}>
    <div className="rounded-md" style={{ backgroundColor: `var(--${pair.backdrop ?? "background"})` }}>
      <div ref={element => { if (element) samples.current.set(pair.id, element); else samples.current.delete(pair.id); }}
        aria-label={`${pair.id} 配对样本`} className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: `var(--${pair.background})`, color: `var(--${pair.foreground})` }}>
        {pair.scope === "non-text" ? <Pin aria-label="已固定图标" className="size-4" fill="currentColor" /> : pair.label ?? "笔记文字 · MemoCard"}
      </div>
    </div>
    <code className="block break-all text-xs">{pair.foreground} / {pair.background}</code>
    <span className="block break-all text-xs">{pair.source}</span>
    <output aria-label={`${pair.id} 对比度`} data-ratio={measurements[pair.id]?.ratio}
      data-result={measurements[pair.id] ? pair.scope === "diagnostic" ? "diagnostic" : measurements[pair.id].ratio >= (pair.scope === "non-text" ? 3 : 4.5) ? "pass" : "fail" : "pending"}
      className="block text-xs tabular-nums">{measurements[pair.id] ? `${measurements[pair.id].ratio.toFixed(2)}:1 · ${result(pair, measurements[pair.id])}` : "正在读取生产颜色…"}</output>
    {pair.note && <p className="text-xs">{pair.note}</p>}
  </div>;
  return <main className="max-w-5xl space-y-8 bg-background p-4 text-foreground sm:p-6">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">颜色与状态语义</h1><p className="text-sm">角色来自生产 CSS，明暗、强调色与中性色由现有 ThemeProvider 解析。颜色不是另一套静态色板。</p></header>
    <section aria-label="文字颜色配对" className="space-y-3">
      <h2 className="text-lg font-semibold">真实文字配对</h2>
      <p className="text-sm">浏览器将当前 CSS 解析为 sRGB，透明背景先叠到样本的实色底层；再按 <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html" className="underline">WCAG 2.2 普通文字 4.5:1</a>计算。固定图标采用<a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html" className="underline">非文本 3:1</a>，容器配对另标为诊断。显示值保留两位，判定使用未舍入比值。仅检查这些平面样本，不代表整页或所有组件符合 AA。</p>
      <p className="text-sm">低于阈值的生产色对保留并明确标为既有问题，不修改默认外观、不降低门槛。交互测试验证测量、状态和已知问题清单，不能把测试通过视为全部颜色 AA 通过。</p>
      <output aria-label="颜色诊断汇总" className="block text-sm">{Object.keys(measurements).length ? `${theme} / ${palette} / ${neutralPalette} · ${contrastPairs.length} 组：20 文字、1 图标、1 容器诊断 · ${failures} 组文字 AA 未达标；${diagnosticFailures} 组容器诊断低于 4.5` : "正在读取生产颜色…"}</output>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{semanticPairs.map(pairSample)}</div>
    </section>
    <ProductionStates />
    <section className="space-y-3"><h2 className="text-lg font-semibold">界面语义色</h2><p className="text-sm">chart-*、emphasis 与 sidebar-primary 两组前景/背景目前保留定义，尚无生产消费者；目录展示不代表已接入。实际消费见 design/token-consumption.md。</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {colorRoles.map(({ name, variable }) => <div key={name} className="overflow-hidden rounded-lg border">
        <div aria-label={`${name} 色样`} className="h-14" style={{ backgroundColor: `var(${variable})` }} />
        <div className="space-y-1 border-t p-2 text-xs"><code className="block break-all">{name}</code><span className="block break-all">{variable}</span></div>
      </div>)}
    </div></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">标签颜色</h2><p className="text-sm">保留默认与八种标签配色；前景与透明背景成对测量，同一组解析值供 iOS 自定义内容区使用。</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tagPairs.map(pairSample)}</div></section>
  </main>;
}
