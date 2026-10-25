import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HugeiconsIcon } from "@hugeicons/react";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Home01Icon from "@hugeicons/core-free-icons/Home01Icon";
import InboxIcon from "@hugeicons/core-free-icons/InboxIcon";
import Moon02Icon from "@hugeicons/core-free-icons/Moon02Icon";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import RoboticIcon from "@hugeicons/core-free-icons/RoboticIcon";
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import Sun03Icon from "@hugeicons/core-free-icons/Sun03Icon";
import { scenarios } from "./scenarios";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "../components/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../components/select";
import { cn } from "../lib/utils";
import { PreviewModeProvider } from "../preview-mode";
import "../styles.css";
import "../preview-appearance.css";
import "./preview.css";

const categories = [
  { id: "errors", title: "异常状态", description: "检查连接与加载、草稿恢复、保存冲突和错误反馈。", icon: AlertCircleIcon, scenarios: scenarios.filter(item => item.group !== "空状态") },
  { id: "empty", title: "空状态", description: "检查空笔记库、搜索无结果和筛选无结果。", icon: InboxIcon, scenarios: scenarios.filter(item => item.group === "空状态") },
];
const viewportItems = [{ value: "desktop", label: "桌面 · 自适应" }, { value: "mobile", label: "窄屏 · 375px" }];
const delayItems = [{ value: "0", label: "正常读取" }, { value: "2000", label: "慢速读取 · 2s" }];

function readLocation() {
  const params = new URLSearchParams(window.location.search);
  const selected = scenarios.find(item => item.id === params.get("scenario"));
  const category = selected ? categories.find(item => item.scenarios.includes(selected)) : categories.find(item => item.id === params.get("category"));
  return {
    category,
    scenario: category?.scenarios.find(item => item.id === selected?.id) ?? category?.scenarios[0],
    theme: params.get("theme") === "dark" ? "dark" as const : "light" as const,
    viewport: params.get("viewport") === "mobile" ? "mobile" : "desktop",
    delay: params.get("delay") === "2000" ? "2000" : "0",
  };
}

function Preview() {
  const [location, setLocation] = useState(readLocation);
  const [revision, setRevision] = useState(0);
  const { category, scenario, theme, viewport, delay } = location;
  useEffect(() => {
    const update = () => setLocation(readLocation());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  function update(next: Partial<typeof location>) {
    const value = { ...location, ...next };
    const params = new URLSearchParams();
    if (value.category) params.set("category", value.category.id);
    if (value.scenario) params.set("scenario", value.scenario.id);
    params.set("theme", value.theme);
    if (value.viewport === "mobile") params.set("viewport", value.viewport);
    if (value.delay !== "0") params.set("delay", value.delay);
    window.history.pushState(null, "", `/?${params}`);
    setLocation(value);
  }
  const index = category && scenario ? category.scenarios.indexOf(scenario) : 0;
  const homeUrl = `/?theme=${theme}`;
  const frameUrl = scenario ? `/client.html?scenario=${scenario.id}&theme=${theme}&delay=${delay}` : "";
  const scenarioItems = category?.scenarios.map((item, i) => ({ value: item.id, label: `${String(i + 1).padStart(2, "0")} · ${item.label}` })) ?? [];
  return <PreviewModeProvider mode={theme}>
    <div className={cn("ui-next-theme preview-next", category ? "preview-next-workbench" : "preview-next-home")} data-ui-theme={theme}>
      <header className="preview-next-header">
        <div className="preview-next-brand"><img src="/favicon.png" alt="" className="size-7 shrink-0 object-contain" /><span className="font-medium">MemoCard</span><Badge variant="secondary">UI-next</Badge></div>
        <div className="flex items-center gap-2">
          <span className="preview-next-isolation"><HugeiconsIcon icon={Shield01Icon} strokeWidth={2} aria-hidden="true" className="size-4 shrink-0" /><span>纯模拟数据<span className="hidden sm:inline"> · 不连接真实笔记库</span></span></span>
          <Button variant="ghost" size="icon-sm" aria-label={theme === "light" ? "切换深色主题" : "切换浅色主题"} title={theme === "light" ? "切换深色主题" : "切换浅色主题"} onClick={() => update({ theme: theme === "light" ? "dark" : "light" })}><HugeiconsIcon icon={theme === "light" ? Moon02Icon : Sun03Icon} strokeWidth={2} aria-hidden="true" /></Button>
        </div>
      </header>
      {category && scenario ? <>
        <section className="preview-next-controls" aria-labelledby="preview-title">
          <div className="flex min-w-0 items-center gap-2">
            <Button role="link" nativeButton={false} variant="ghost" size="icon-sm" render={<a href={homeUrl} />} aria-label="返回验收首页" title="返回验收首页"><HugeiconsIcon icon={Home01Icon} strokeWidth={2} aria-hidden="true" /></Button>
            <h1 id="preview-title" className="text-balance text-lg font-medium">{category.title}验收</h1>
            <Badge variant="outline" className="ml-auto tabular-nums">{index + 1} / {category.scenarios.length}</Badge>
          </div>
          <div className="preview-next-toolbar">
            <div className="preview-next-scenario-select">
              <Select items={scenarioItems} value={scenario.id} onValueChange={id => { const next = category.scenarios.find(item => item.id === id); if (next) update({ scenario: next }); }}>
                <SelectTrigger aria-label="验收场景" className="w-full min-w-0" title={scenario.label}><SelectValue><span className="truncate">{scenarioItems[index]?.label}</span></SelectValue></SelectTrigger>
                <SelectContent align="start" className="preview-next-scenario-menu">
                  {[...new Set(category.scenarios.map(item => item.group))].map(group => <SelectGroup key={group}><SelectLabel>{group}</SelectLabel>{category.scenarios.map((item, i) => item.group === group ? <SelectItem key={item.id} value={item.id}>{scenarioItems[i].label}</SelectItem> : null)}</SelectGroup>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="场景导航">
              <Button variant="outline" size="icon" aria-label="上一项" title="上一项" disabled={index === 0} onClick={() => update({ scenario: category.scenarios[index - 1] })}><HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" /></Button>
              <Button variant="outline" size="icon" aria-label="下一项" title="下一项" disabled={index === category.scenarios.length - 1} onClick={() => update({ scenario: category.scenarios[index + 1] })}><HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" /></Button>
              <Button variant="ghost" size="icon" aria-label="重置场景" title="重置场景" onClick={() => setRevision(value => value + 1)}><HugeiconsIcon icon={RefreshIcon} strokeWidth={2} aria-hidden="true" /></Button>
            </div>
            <Select items={viewportItems} value={viewport} onValueChange={value => { if (value) update({ viewport: value }); }}><SelectTrigger aria-label="预览尺寸" className="preview-next-viewport-select"><SelectValue /></SelectTrigger><SelectContent>{viewportItems.map(item => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
            <Select items={delayItems} value={delay} onValueChange={value => { if (value) update({ delay: value }); }}><SelectTrigger aria-label="读取速度" className="preview-next-delay-select"><SelectValue /></SelectTrigger><SelectContent>{delayItems.map(item => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="preview-next-instructions" aria-live="polite"><p className="text-pretty text-sm">{scenario.instructions}</p>{scenario.note ? <p className="text-pretty text-xs text-secondary">{scenario.note}</p> : null}</div>
        </section>
        <main className="preview-next-stage" aria-label="新版 UI 场景预览">
          <iframe key={`${scenario.id}:${revision}:${viewport}:${theme}:${delay}`} title={`模拟场景：${scenario.label}`} className={cn("preview-next-frame", viewport === "mobile" && "preview-next-frame-mobile")} sandbox="allow-scripts allow-same-origin allow-modals" src={frameUrl} />
        </main>
      </> : <main className="preview-next-home-content">
        <div className="space-y-2"><h1 className="text-balance text-2xl font-medium">UI 验收</h1><p className="text-pretty text-sm text-secondary">选择状态，检查新版界面和操作。</p></div>
        <nav aria-label="验收页面" className="preview-next-category-grid">
          {categories.map(item => <a key={item.id} href={`/?category=${item.id}&theme=${theme}`} aria-label={`${item.title}，${item.scenarios.length} 个场景`} className="preview-next-category-link">
            <Card size="sm" className="h-full gap-4">
              <CardHeader><div className="flex min-w-0 items-center gap-3"><span className="preview-next-category-icon"><HugeiconsIcon icon={item.icon} strokeWidth={2} aria-hidden="true" /></span><h2 className="text-balance text-base font-medium">{item.title}</h2><Badge variant="secondary" className="ml-auto tabular-nums">{item.scenarios.length} 个场景</Badge></div></CardHeader>
              <CardContent><CardDescription className="text-pretty leading-relaxed">{item.description}</CardDescription></CardContent>
              <CardFooter className="mt-auto justify-between border-t text-sm font-medium"><span>开始验收</span><HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" className="size-4" /></CardFooter>
            </Card>
          </a>)}
          <a href={`/mascots.html?theme=${theme}`} aria-label="吉祥物，13 个角色" className="preview-next-category-link">
            <Card size="sm" className="h-full gap-4"><CardHeader><div className="flex min-w-0 items-center gap-3"><span className="preview-next-category-icon"><HugeiconsIcon icon={RoboticIcon} strokeWidth={2} aria-hidden="true" /></span><h2 className="text-balance text-base font-medium">吉祥物</h2><Badge variant="secondary" className="ml-auto tabular-nums">13 个角色</Badge></div></CardHeader><CardContent><CardDescription className="text-pretty leading-relaxed">预览 MemoCard 与机器人角色的鼠标跟随和点击反应。</CardDescription></CardContent><CardFooter className="mt-auto justify-between border-t text-sm font-medium"><span>打开预览</span><HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" className="size-4" /></CardFooter></Card>
          </a>
        </nav>
      </main>}
    </div>
  </PreviewModeProvider>;
}

const root = createRoot(document.getElementById("root")!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
