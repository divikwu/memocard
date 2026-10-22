import { useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { useTheme } from "../src/features/theme/ThemeProvider";
import { tagColors } from "../src/tag-colors";
import { measurePair } from "./foundation-color-contrast";
import "../src/tag-colors.css";

type Pair = { id: string; foreground: string; background: string; source: string; backdrop?: string; label?: string; scope?: "non-text" | "diagnostic"; note?: string };
const semanticPairs: Pair[] = [
  { id: "page", foreground: "foreground", background: "background", source: "features/theme/tokens.css / App" },
  { id: "card", foreground: "card-foreground", background: "card", source: "components/ui/card.tsx" },
  { id: "popover", foreground: "popover-foreground", background: "popover", source: "components/ui/popover.tsx" },
  { id: "primary", foreground: "primary-foreground", background: "primary", source: "components/ui/button.tsx · default" },
  { id: "secondary", foreground: "secondary-foreground", background: "secondary", source: "components/ui/button.tsx · secondary" },
  { id: "muted-page", foreground: "muted-foreground", background: "background", source: "features/theme/ThemeSettings.tsx · 辅助说明" },
  { id: "muted-surface", foreground: "muted-foreground", background: "muted", source: "components/ui/tabs.tsx · TabsList", scope: "diagnostic", note: "容器角色；实际 Tab 文字另行覆写。本项仅诊断配对，不据此判断页面文字 AA。" },
  { id: "accent", foreground: "accent-foreground", background: "accent", source: "features/theme/tokens.css · 选中角色 / 搜索选中背景" },
  { id: "accent-text", foreground: "accent-text", background: "background", source: "components/note-pin-button.tsx", scope: "non-text", note: "当前用于已固定图标，采用非文本 3:1；不是文字色 AA 验收。" },
  { id: "destructive-text", foreground: "destructive", background: "background", source: "NoteProperties.tsx · 错误说明" },
  { id: "hover", foreground: "foreground", background: "hover-bg", source: "components/ui/button.tsx · outline hover" },
  { id: "sidebar", foreground: "sidebar-foreground", background: "sidebar", source: "components/ui/sidebar.tsx" },
  { id: "sidebar-selected", foreground: "sidebar-accent-foreground", background: "sidebar-accent", backdrop: "sidebar", source: "components/ui/sidebar.tsx · active" },
];
const tagPairs: Pair[] = tagColors.map(([id, label]) => ({ id: `tag-${id}`, label, foreground: `tag-${id}-fg`, background: `tag-${id}-bg`, source: "TagPill.tsx / tag-colors.tokens.css" }));
export const contrastPairs = [...semanticPairs, ...tagPairs];
type Measurement = ReturnType<typeof measurePair>;

export function Colors() {
  const { theme, palette, neutralPalette } = useTheme();
  const samples = useRef(new Map<string, HTMLElement>());
  const [measurements, setMeasurements] = useState<Record<string, Measurement>>({});
  useEffect(() => {
    setMeasurements(Object.fromEntries(contrastPairs.map(pair => [pair.id, measurePair(samples.current.get(pair.id)!)])));
  }, [theme, palette, neutralPalette]);
  const failures = contrastPairs.filter(pair => !pair.scope && measurements[pair.id]?.ratio < 4.5).length;
  const iconFailures = contrastPairs.filter(pair => pair.scope === "non-text" && measurements[pair.id]?.ratio < 3).length;
  const diagnosticFailures = contrastPairs.filter(pair => pair.scope === "diagnostic" && measurements[pair.id]?.ratio < 4.5).length;
  const result = (pair: Pair, value: Measurement) => pair.scope === "diagnostic" ? `${value.ratio < 4.5 ? "低于" : "达到"} 4.5:1（容器配对诊断）`
    : pair.scope === "non-text" ? `图标 3:1 ${value.ratio >= 3 ? "通过" : "未达标（既有问题）"}`
    : value.ratio >= 4.5 ? "文字 AA 通过" : "文字 AA 未达标（既有问题）";
  return <main className="foundation-color-diagnostics max-w-5xl space-y-6 bg-background p-4 text-foreground sm:p-6" aria-busy={Object.keys(measurements).length !== contrastPairs.length}>
    <header className="space-y-2">
      <h1 className="text-balance text-2xl font-semibold">颜色诊断</h1>
      <output aria-label="颜色诊断汇总" className="block text-sm tabular-nums">{Object.keys(measurements).length ? `${theme} / ${palette} / ${neutralPalette} · ${contrastPairs.length} 组 · 文字未达标 ${failures} · 图标未达标 ${iconFailures} · 容器诊断低于阈值 ${diagnosticFailures}` : "正在读取生产颜色…"}</output>
      <p className="text-pretty text-sm text-muted-foreground">检查当前样本；容器配对诊断不等同于文字合规结论。</p>
    </header>
    <section aria-label="文字颜色配对" className="space-y-3">
      <h2 className="text-balance text-lg font-semibold">配对结果</h2>
      <div role="region" aria-label="颜色配对结果，可横向滚动" tabIndex={0} className="max-w-full overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <table className="w-full min-w-2xl table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">颜色配对结果</caption>
          <thead className="border-b text-muted-foreground"><tr>
            <th scope="col" className="w-1/3 px-3 py-3 font-medium">配对</th>
            <th scope="col" className="w-1/4 px-3 py-3 font-medium">样本</th>
            <th scope="col" className="w-24 px-3 py-3 text-right font-medium">对比度</th>
            <th scope="col" className="px-3 py-3 font-medium">结论</th>
          </tr></thead>
          <tbody>{contrastPairs.map(pair => <tr key={pair.id} data-pair-id={pair.id} className="border-b last:border-b-0">
            <th scope="row" className="break-words px-3 py-2.5 align-middle font-normal">
              <code className="block text-xs">{pair.foreground}</code><code className="block text-xs text-muted-foreground">/ {pair.background}</code>
            </th>
            <td className="px-3 py-2.5 align-middle"><div className="rounded-md" style={{ backgroundColor: `var(--${pair.backdrop ?? "background"})` }}>
              <div ref={element => { if (element) samples.current.set(pair.id, element); else samples.current.delete(pair.id); }}
                aria-label={`${pair.id} 配对样本`} className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: `var(--${pair.background})`, color: `var(--${pair.foreground})` }}>
                {pair.scope === "non-text" ? <Pin aria-label="已固定图标" className="size-4" fill="currentColor" /> : pair.label ?? "笔记文字"}
              </div>
            </div></td>
            <td className="px-3 py-2.5 text-right align-middle font-mono text-xs tabular-nums">{measurements[pair.id] ? `${measurements[pair.id].ratio.toFixed(2)}:1` : "—"}</td>
            <td className="px-3 py-2.5 align-middle"><output aria-label={`${pair.id} 对比度`} data-ratio={measurements[pair.id]?.ratio}
              data-result={measurements[pair.id] ? pair.scope === "diagnostic" ? "diagnostic" : measurements[pair.id].ratio >= (pair.scope === "non-text" ? 3 : 4.5) ? "pass" : "fail" : "pending"}
              className="block text-xs">{measurements[pair.id] ? result(pair, measurements[pair.id]) : "测量中…"}</output>
              {pair.note && <p className="mt-1 text-pretty text-xs text-muted-foreground">{pair.note}</p>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </main>;
}
