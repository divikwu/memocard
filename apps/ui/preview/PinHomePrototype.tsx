// Throwaway prototype: home with the existing compact list; pin actions in detail.
// Run: pnpm --filter @memocard/ui dev:states. All note and pin state stays in memory.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Clock3, Hash, House, Layers, LayoutGrid, List, MoreHorizontal, Notebook, PanelLeft, Pin, Plus, RotateCcw, Search, X } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { Card, CardContent } from "../src/components/ui/card";
import { Input } from "../src/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import TagPill from "../src/TagPill";
import { NotePreview } from "../src/NotePreview";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip";
import { QuickCapturePrototype, type CaptureImage, type CaptureValue } from "./QuickCapturePrototype";
import "./styles.css";
import "../src/tag-colors.css";
import "./pin-home-prototype.css";

type DemoNote = { id: string; title: string; summary: string; tags: string[]; updatedAt: string; sections: { heading: string; text: string }[]; images?: CaptureImage[] };
const initialNotes: DemoNote[] = [
  { id: "homepage", title: "主页，让常用内容触手可及", summary: "把经常翻看的笔记固定在主页，再从最近更新继续上一次的思考。", tags: ["产品设计"], updatedAt: "2026-10-14T10:24:00+08:00", sections: [
    { heading: "从这里继续", text: "主页是进入笔记库的起点。默认显示最近更新的笔记，切换到已固定可以找到常用内容。两种内容都能切换卡片或列表布局。" },
    { heading: "把重要的内容留在眼前", text: "一份正在推进的项目计划、一张反复使用的检查清单，或是一篇想慢慢读完的文章，都可以固定在主页。点击右上角的大头钉即可固定，再点一次取消。" },
    { heading: "固定入口，保留原来的组织", text: "固定之后，笔记仍然留在原来的位置，也可以通过标签和所有笔记找到。固定只是在主页多放了一个入口。" },
  ] },
  { id: "design-system", title: "设计系统 · 本周工作", summary: "梳理导航与展示组件，整理交互规范和下一轮需要验证的细节。", tags: ["工作", "设计系统"], updatedAt: "2026-10-14T09:40:00+08:00", sections: [{ heading: "本周重点", text: "回顾组件在真实页面里的使用情况，优先处理影响日常操作的细节。保持命名、间距和交互反馈一致。" }, { heading: "待验证", text: "检查键盘焦点是否清晰、窄屏是否有遮挡，以及不同状态的按钮位置是否稳定。" }] },
  { id: "reading", title: "阅读笔记：设计中的取舍", summary: "减少理解与操作成本，让每一个界面元素都有明确的用途。", tags: ["阅读", "产品设计"], updatedAt: "2026-10-13T17:15:00+08:00", sections: [{ heading: "值得记住的观点", text: "界面的简洁不取决于元素的数量，而取决于用户需要猜测多少次。熟悉的模式、直接的文案和可预期的反馈，让人更容易做出决定。" }, { heading: "应用到日常工作", text: "先描述用户要完成的任务，再判断每一个操作是否必要。让频繁使用的入口更容易找到。" }] },
  { id: "checklist", title: "上线前检查清单", summary: "从主流程、内容和小屏幕三个方面，检查设计是否可以交付。", tags: ["工作"], updatedAt: "2026-10-13T15:30:00+08:00", sections: [{ heading: "主流程", text: "打开、查找、编辑与返回都能顺利完成。操作之后有清楚的反馈，取消操作不会丢失已有内容。" }, { heading: "内容与布局", text: "检查长标题、空列表和较小屏幕下的排版。确认主要按钮始终可见，辅助信息不会抢占注意力。" }] },
  { id: "ideas", title: "随手记 · 灵感收集", summary: "把零散的观察先记下来，等有时间时再连成完整的想法。", tags: ["生活"], updatedAt: "2026-10-13T11:20:00+08:00", sections: [{ heading: "今天的观察", text: "好的工具往往让人忘记工具本身。打开之后知道从哪里继续，完成之后不需要额外整理。" }] },
  { id: "writing", title: "写作：先把想法说清楚", summary: "一句具体的话，比一段抽象的总结更容易让人理解。", tags: ["阅读"], updatedAt: "2026-10-12T16:45:00+08:00", sections: [{ heading: "从具体的事情开始", text: "先写发生了什么，再写为什么重要。把最想表达的观点放在前面，用例子帮助读者理解。" }] },
  { id: "weekend", title: "周末散步路线", summary: "找一条安静的路，带上相机，留出没有安排的时间。", tags: ["生活"], updatedAt: "2026-10-11T18:10:00+08:00", sections: [{ heading: "慢一点", text: "沿着河边走到公园，看看树叶和路过的人。如果天气好，就在附近的咖啡店坐一会儿。" }] },
];
const initialPins = ["design-system", "checklist", "reading"];
type Page = "home" | "notes";
function readRoute() { const hash = location.hash; return { page: (hash.startsWith("#/notes") ? "notes" : "home") as Page, noteId: hash.startsWith("#/note/") ? hash.slice(7) : null }; }
function dateLabel(value: string) {
  const date = new Date(value);
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const time = date.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });
  return day === "2026-10-14" ? `今天 ${time}` : day === "2026-10-13" ? `昨天 ${time}` : `${date.getMonth() + 1}月${date.getDate()}日`;
}

function Prototype() {
  const quickCapture = new URLSearchParams(location.search).has("quick-capture");
  const [notes, setNotes] = useState(initialNotes);
  const [route, setRoute] = useState(readRoute);
  const [returnPage, setReturnPage] = useState<Page>("home");
  const [pins, setPins] = useState(initialPins);
  const [layout, setLayout] = useState<"cards" | "list">("cards");
  const [homeTab, setHomeTab] = useState<"recent" | "pinned">("recent");
  const [homeLayout, setHomeLayout] = useState<"cards" | "list">("list");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const note = notes.find(item => item.id === route.noteId);
  const filtered = notes.filter(item => (!tag || item.tags.includes(tag)) && `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));
  const pinnedNotes = pins.map(id => notes.find(item => item.id === id)!);
  useEffect(() => { document.title = quickCapture ? "MemoCard · 快速输入原型" : "MemoCard · 主页与固定原型"; }, [quickCapture]);
  useEffect(() => { const update = () => { setRoute(readRoute()); setSidebarOpen(false); }; window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 2300); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = note ? 0 : listScroll.current; }, [note, route.page]);
  function navigate(page: Page, nextTag: string | null = null) { listScroll.current = 0; setTag(nextTag); setQuery(""); setRoute({ page, noteId: null }); location.hash = `#/${page}`; setSidebarOpen(false); }
  function openNote(item: DemoNote) { listScroll.current = scroll.current?.scrollTop || 0; setReturnPage(route.page); setRoute({ ...route, noteId: item.id }); location.hash = `#/note/${item.id}`; }
  function back() { setRoute({ page: returnPage, noteId: null }); location.hash = `#/${returnPage}`; }
  function togglePin(id: string) { const removing = pins.includes(id); setPins(current => removing ? current.filter(value => value !== id) : [id, ...current]); setNotice(removing ? "已取消固定" : "已固定到主页"); }
  function record(value: CaptureValue) {
    setNotes(current => [{id: crypto.randomUUID(), title: value.text.split("\n")[0]?.slice(0, 40) || "图片笔记", summary: value.text, tags: value.tags, images: value.images, updatedAt: new Date().toISOString(), sections: []}, ...current]);
    setHomeTab("recent"); setNotice("已记录（原型演示）");
  }
  function pinButton(item: DemoNote) {
    const active = pins.includes(item.id), label = active ? "取消固定" : "固定到主页";
    return <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" className={`pin-prototype-button ${active ? "is-pinned" : ""}`} aria-label={`${label}：${item.title}（详情）`} aria-pressed={active} onClick={() => togglePin(item.id)}><Pin className="size-4" fill={active ? "currentColor" : "none"} /></Button>} /><TooltipContent>{label}</TooltipContent></Tooltip>;
  }
  function cards(items: DemoNote[], context = "所有笔记卡片") {
    // Match NoteCollection's cards, including dimensions, preview and tag controls.
    return <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4" data-layout="cards" aria-label={context}>{items.map(item => <li className="min-w-0" key={item.id}>
      <Card className="h-64 gap-0 overflow-hidden rounded-[16px] border border-border bg-card py-0 shadow-[0_4px_12px_rgba(25,25,25,0.027),0_1px_2px_rgba(25,25,25,0.02)] transition-colors hover:bg-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"><CardContent className="flex h-full min-h-0 flex-col p-0">
        <button type="button" className="flex min-h-0 min-w-0 flex-1 flex-col text-left outline-none" aria-label={`打开 ${item.title}`} onClick={() => openNote(item)}>
          <div className="w-full px-4 pb-2 pt-4"><span className="block min-w-0 truncate text-base font-medium">{item.title}</span><time className="mt-1 block text-xs text-muted-foreground/80" dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time></div>
          <div className="min-h-0 w-full flex-1 overflow-hidden px-4 pb-4"><NotePreview compact showTitle={false} hiddenTags={item.tags} title={item.title} body={[item.summary, ...item.sections.map(section => `## ${section.heading}\n\n${section.text}`)].join("\n\n")} notePath={`notes/${item.id}.md`} onError={setNotice} />{item.images?.[0] && <img className="quick-capture-card-image" src={item.images[0].src} alt={item.images[0].name} />}</div>
        </button>
        <div className="flex min-h-10 items-center gap-2 overflow-hidden px-4 pb-3">{item.tags.slice(0, 2).map(value => <TagPill key={value} name={value} render={<button type="button" aria-label={`筛选标签 ${value}`} onClick={() => navigate("notes", value)} />} className="h-5 px-1.5 py-0 font-normal"><span className="truncate">{value}</span></TagPill>)}{item.tags.length > 2 && <span className="shrink-0 text-xs text-muted-foreground/60">+{item.tags.length - 2}</span>}</div>
      </CardContent></Card>
    </li>)}</ul>;
  }
  function rows(items: DemoNote[], context: string) {
    // Match NoteCollection's list markup and primitives without changing production code.
    return <ul className="flex flex-col" data-layout="list" aria-label={context}>{items.map(item => <li className="min-w-0" key={item.id}>
      <Card className="gap-0 overflow-hidden rounded-lg border-0 bg-card py-0 shadow-none transition-colors hover:bg-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"><CardContent className="flex h-full min-h-0 flex-row items-center p-0">
        <button onClick={() => openNote(item)} aria-label={`打开 ${item.title}`} className="flex min-h-0 min-w-0 flex-1 flex-col text-left outline-none"><div className="w-full px-2 py-2"><span className="block min-w-0 truncate text-sm font-medium">{item.title}</span></div></button>
        <div className="flex min-w-0 max-w-1/3 shrink-0 items-center gap-2 overflow-hidden pr-2">{item.tags.slice(0, 2).map(value => <TagPill key={value} name={value} render={<button type="button" aria-label={`筛选标签 ${value}`} onClick={() => navigate("notes", value)} />} className="h-5 min-w-0 shrink px-1.5 py-0 font-normal"><span className="truncate">{value}</span></TagPill>)}{item.tags.length > 2 && <span className="shrink-0 text-xs text-muted-foreground/60">+{item.tags.length - 2}</span>}</div>
        <time className="w-28 shrink-0 whitespace-nowrap pr-2 text-right text-xs tabular-nums text-muted-foreground/80" dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time>
      </CardContent></Card>
    </li>)}</ul>;
  }
  const title = note?.title || (route.page === "home" ? "主页" : tag ? `# ${tag}` : "所有笔记");
  return <TooltipProvider><div className={`pin-prototype-shell ${quickCapture ? "quick-capture-shell" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
    {sidebarOpen && <button className="pin-prototype-backdrop" aria-label="关闭导航" onClick={() => setSidebarOpen(false)} />}
    <aside className={`pin-prototype-sidebar ${sidebarOpen ? "mobile-open" : ""}`} aria-label="笔记导航">
      <button className="pin-prototype-brand" onClick={() => navigate("home")}><img src="/favicon.png" alt="" /><strong>MemoCard</strong></button>
      <nav aria-label="主要导航">
        <button onClick={() => { navigate("notes"); requestAnimationFrame(() => input.current?.focus()); }}><Search /><span>搜索</span></button>
        <button disabled title="此原型用于预览主页和固定操作"><Plus /><span>新建笔记</span></button>
        <button aria-current={!note && route.page === "home" ? "page" : undefined} onClick={() => navigate("home")}><House /><span>主页</span></button>
        <button aria-current={!note && route.page === "notes" && !tag ? "page" : undefined} onClick={() => navigate("notes")}><Notebook /><span>所有笔记</span></button>
      </nav>
      <div className="pin-prototype-tag-heading">标签<ChevronDown className="size-3" /></div>
      <nav aria-label="标签">{["工作", "设计系统", "产品设计", "阅读", "生活"].map(value => <button key={value} aria-current={tag === value && !note ? "page" : undefined} onClick={() => navigate("notes", value)}><Hash /><span>{value}</span></button>)}</nav>
      <div className="pin-prototype-vault"><Layers className="size-4" /><span>示例笔记库</span><ChevronDown className="size-3" /></div>
    </aside>
    <main className="pin-prototype-main">
      <header className="pin-prototype-header"><div className="pin-prototype-breadcrumb">
        {note && <Button variant="ghost" size="icon-sm" aria-label="返回" onClick={back}><ArrowLeft /></Button>}
        <Button variant="ghost" size="icon-sm" aria-label="切换侧栏" onClick={() => window.matchMedia("(max-width: 700px)").matches ? setSidebarOpen(!sidebarOpen) : setCollapsed(!collapsed)}><PanelLeft /></Button><span className="pin-prototype-header-divider" />
        {note ? <><button onClick={back}>{returnPage === "home" ? "主页" : "所有笔记"}</button><ChevronRight className="size-3" /><span className="truncate">{title}</span></> : <span>{title}</span>}
      </div><div className="pin-prototype-header-actions">{note && <><span className="pin-prototype-detail-time">更新于 {dateLabel(note.updatedAt)}</span>{pinButton(note)}</>}<Button variant="ghost" size="icon-sm" disabled aria-label="更多操作"><MoreHorizontal /></Button></div></header>
      <div ref={scroll} className="pin-prototype-scroll"><div className={`pin-prototype-content ${note ? "detail" : route.page === "home" ? "home" : ""}`}>
        {note ? <article className="pin-prototype-article"><h1>{note.title}</h1><div className="pin-prototype-tags">{note.tags.map(value => <button key={value} onClick={() => navigate("notes", value)}>{value}</button>)}</div><p className="pin-prototype-lead">{note.summary}</p>{note.images && <div className="quick-capture-record-images">{note.images.map(image => <img key={image.src} src={image.src} alt={image.name} />)}</div>}{note.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2><p>{section.text}</p></section>)}</article> : route.page === "home" ? <>
          <div className="pin-prototype-page-heading"><h1>主页</h1><p>常用的内容，最近的思考。</p></div>
          {quickCapture && <QuickCapturePrototype onRecord={record} />}
          <Tabs value={homeTab} onValueChange={value => { if (value === "recent" || value === "pinned") { setHomeTab(value); listScroll.current = 0; } }} className="gap-5">
            <div className="pin-prototype-home-toolbar">
              <TabsList variant="line" aria-label="主页内容" className="gap-2 group-data-[orientation=horizontal]/tabs:h-9">
                <TabsTrigger value="recent" className="px-1"><Clock3 className="size-4" />最近更新</TabsTrigger>
                <TabsTrigger value="pinned"><Pin className="size-4" />已固定<span className="pin-prototype-count">{pins.length}</span></TabsTrigger>
              </TabsList>
              <div className="pin-prototype-layout" role="group" aria-label="主页布局"><Button size="icon-sm" variant="ghost" aria-label="卡片布局" aria-pressed={homeLayout === "cards"} onClick={() => setHomeLayout("cards")}><LayoutGrid /></Button><Button size="icon-sm" variant="ghost" aria-label="列表布局" aria-pressed={homeLayout === "list"} onClick={() => setHomeLayout("list")}><List /></Button></div>
            </div>
            <TabsContent value="recent">{homeLayout === "cards" ? cards(notes, "最近更新") : rows(notes, "最近更新")}</TabsContent>
            <TabsContent value="pinned">{pins.length ? homeLayout === "cards" ? cards(pinnedNotes, "已固定笔记") : rows(pinnedNotes, "已固定笔记") : <div className="pin-prototype-empty"><Pin className="size-5" /><strong>把常用笔记固定在这里</strong><p>在笔记详情右上角点击大头钉，即可固定到主页。</p><Button variant="outline" size="sm" onClick={() => navigate("notes")}>浏览笔记<ChevronRight className="size-3" /></Button></div>}</TabsContent>
          </Tabs>
        </> : <><div className="pin-prototype-page-heading"><h1>{tag ? `# ${tag}` : "所有笔记"}</h1></div><div className="pin-prototype-toolbar"><div className="pin-prototype-search"><Search className="size-4" /><Input ref={input} aria-label="搜索笔记" placeholder="搜索笔记内容" value={query} onChange={event => setQuery(event.target.value)} />{query && <Button size="icon-xs" variant="ghost" aria-label="清空搜索" onClick={() => setQuery("")}><X /></Button>}</div><div className="pin-prototype-layout" role="group" aria-label="笔记布局"><Button size="icon-sm" variant="ghost" aria-label="卡片布局" aria-pressed={layout === "cards"} onClick={() => setLayout("cards")}><LayoutGrid /></Button><Button size="icon-sm" variant="ghost" aria-label="列表布局" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List /></Button></div></div>{filtered.length ? layout === "cards" ? cards(filtered) : rows(filtered, "所有笔记列表") : <div className="pin-prototype-empty"><Search className="size-5" /><strong>没有找到相关笔记</strong><p>换一个关键词，或清空搜索。</p></div>}</>}
      </div></div>
    </main>
    <div className="pin-prototype-tools"><span>交互原型 · 示例数据</span><Button variant="ghost" size="xs" onClick={() => { setNotes(initialNotes); setPins(initialPins); setHomeTab("recent"); setHomeLayout("list"); navigate("home"); setNotice("已恢复初始原型"); }}><RotateCcw className="size-3" />重置</Button></div>
    {notice && <div className="pin-prototype-notice" role="status"><Check className="size-4" />{notice}</div>}
  </div></TooltipProvider>;
}
const root = createRoot(document.getElementById("root")!);
root.render(<Prototype />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
