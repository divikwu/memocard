// PROTOTYPE: compare tag layouts via ?variant=A|B|C|D|E. E flattens every level.
// Uses representative labels from the current UI; no real vault requests or mutations.
import { useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { SidebarIcon } from "./sidebar-icons";
import { cn } from "../lib/utils";
import "./TagsCapsules.prototype.css";

type Tag = { path: string; count: number; icon?: string };
const tag = (path: string, count = 1, icon?: string): Tag => ({ path, count, icon });
const tags = [
  tag("area", 4), tag("area/ai", 2, "🚃"), tag("area/coffee", 1, "☕"), tag("area/design"), tag("area/fitness"), tag("area/management"), tag("area/photography"), tag("area/product"), tag("area/technology", 2), tag("area/work", 2), tag("area/work/uxd", 1, "🧑‍🌾"),
  tag("idea", 2), tag("inbox"), tag("insight"), tag("journal"), tag("journal/coffee"),
  tag("project", 4), tag("project/memocard"), tag("project/portfolio"), tag("project/yami", 4, "🏛️"), tag("project/yami/项目总结", 4), tag("project/yami/项目总结/okr"), tag("project/yami/项目总结/okr/Q4"), tag("project/yami/项目总结/okr/Q4/复盘"),
  tag("reflection"), tag("resource", 3), tag("resource/books"), tag("resource/coffee"), tag("resource/inspiration"), tag("resource/tools", 3), tag("resource/tools/github"), tag("resource/travel"), tag("resource/work"), tag("system"),
];
const roots = tags.filter(item => !item.path.includes("/"));
const tagName = (item: Tag) => item.path.split("/").at(-1)!;
const letter = (item: Tag) => /^[a-z0-9]/i.test(tagName(item)) ? tagName(item)[0].toUpperCase() : "#";
const rootLetter = (item: Tag) => letter({ ...item, path: item.path.split("/")[0] });
const alphabetical = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const variants = ["A", "B", "C", "D", "E"] as const;
type Variant = typeof variants[number];
const labels = { A: "逐层胶囊", B: "字母索引", C: "分组卡片", D: "就地展开", E: "全部平铺" };
const initial = new URLSearchParams(location.search).get("variant");

export function TagsCapsulesPrototype() {
  const [variant, setVariant] = useState<Variant>(initial === "B" || initial === "C" || initial === "D" || initial === "E" ? initial : "A");
  const [query, setQuery] = useState("");
  const [path, setPath] = useState("");
  const [pinned, setPinned] = useState(["area/work/uxd", "area/ai"]);
  const [closed, setClosed] = useState<string[]>([]);
  const [opened, setOpened] = useState<string[]>(() => roots.filter(root => tags.some(item => item.path.startsWith(root.path + "/"))).map(root => root.path));
  const [selected, setSelected] = useState("");
  const [sidebar, setSidebar] = useState(true);
  const needle = query.trim().toLocaleLowerCase();
  const matches = tags.filter(item => item.path.toLocaleLowerCase().includes(needle));
  const letters = [...new Set(matches.map(letter))].sort((a, b) => a === "#" ? 1 : b === "#" ? -1 : alphabetical.compare(a, b));
  const rootLetters = [...new Set(roots.map(letter))].sort((a, b) => a === "#" ? 1 : b === "#" ? -1 : alphabetical.compare(a, b));
  const children = tags.filter(item => item.path.split("/").slice(0, -1).join("/") === path);
  const visible = needle ? matches : children;
  const pathParts = path ? path.split("/") : [];
  const navigate = (next: string) => { setPath(next); setQuery(""); setSelected(""); };
  const parentGroups = roots.filter(root => tags.some(item => item.path.startsWith(root.path + "/")));
  const looseTags = roots.filter(root => !parentGroups.includes(root));
  const switchVariant = (next: Variant) => {
    setVariant(next);
    const url = new URL(location.href); url.searchParams.set("variant", next); history.replaceState(null, "", url);
  };
  const cycle = (step: number) => switchVariant(variants[(variants.indexOf(variant) + step + variants.length) % variants.length]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as Element).closest("input,textarea,[contenteditable],button,a") || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); cycle(event.key === "ArrowRight" ? 1 : -1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const pin = (path: string) => setPinned(current => current.includes(path) ? current.filter(item => item !== path) : [...current, path]);
  const toggleInline = (path: string) => {
    if (needle) {
      setQuery("");
      const parts = path.split("/");
      setOpened(current => [...new Set([...current, ...parts.map((_, index) => parts.slice(0, index + 1).join("/"))])]);
    } else setOpened(current => current.includes(path) ? current.filter(item => item !== path) : [...current, path]);
  };
  const chip = (item: Tag, full = false) => {
    const branch = variant === "D" && tags.some(child => child.path.startsWith(item.path + "/"));
    const expanded = !needle && opened.includes(item.path);
    return <div key={item.path} className={cn("tag-demo-chip", selected === item.path && "tag-demo-chip-selected")}>
    <Button variant="ghost" className="tag-demo-chip-open" title={item.path} aria-label={branch ? `${expanded ? "收起" : "展开"}子标签 ${item.path}` : `选择标签 ${item.path}`} aria-pressed={branch ? undefined : selected === item.path} aria-expanded={branch ? expanded : undefined} aria-controls={branch && expanded ? `tag-demo-inline-${encodeURIComponent(item.path)}` : undefined} onClick={() => branch ? toggleInline(item.path) : setSelected(item.path)}>
      <span className="tag-demo-icon" aria-hidden="true">{item.icon || <SidebarIcon name="hash" />}</span>
      <span className="tag-demo-chip-text">{full || variant === "E" ? item.path : variant !== "C" ? tagName(item) : item.path.split("/").slice(1).join(" / ") || item.path}</span>
      {variant === "B" && tags.filter(other => tagName(other) === tagName(item)).length > 1 && <span className="tag-demo-chip-parent">{item.path.slice(0, item.path.lastIndexOf("/"))}</span>}
      <span className="tag-demo-count">{item.count}</span>
    </Button>
    {variant === "A" && tags.some(child => child.path.startsWith(item.path + "/")) && <Button variant="ghost" size="icon-xs" className="tag-demo-descend" aria-label={`进入子标签 ${item.path}`} onClick={() => navigate(item.path)}><SidebarIcon name="right" /></Button>}
    {variant !== "B" && variant !== "E" && <Button variant="ghost" size="icon-xs" className="tag-demo-pin" aria-label={`${pinned.includes(item.path) ? "取消置顶" : "置顶"} ${item.path}`} aria-pressed={pinned.includes(item.path)} onClick={() => pin(item.path)}><HugeiconsIcon icon={PinIcon} fill={pinned.includes(item.path) ? "currentColor" : "none"} aria-hidden="true" /></Button>}
  </div>;
  };
  const tree = (items: Tag[], parent?: string): ReactNode => <ul className="tag-demo-inline-level" id={parent ? `tag-demo-inline-${encodeURIComponent(parent)}` : undefined}>
    {items.map(item => {
      const children = tags.filter(child => child.path.split("/").slice(0, -1).join("/") === item.path);
      const expanded = children.length > 0 && opened.includes(item.path);
      return <li key={item.path} className="tag-demo-inline-node" data-expanded={expanded || undefined}>
        {chip(item)}
        {expanded && <div className="tag-demo-inline-children">{tree(children, item.path)}</div>}
      </li>;
    })}
  </ul>;
  const group = (root: Tag) => {
    const children = matches.filter(item => item.path.startsWith(root.path + "/"));
    if (needle && !children.length && !matches.includes(root)) return null;
    return <section className="tag-demo-group" key={root.path}>
      <div className="tag-demo-group-heading"><Button variant="ghost" className="tag-demo-group-title" aria-label={`${closed.includes(root.path) ? "展开" : "收起"}分组 ${root.path}`} aria-expanded={!!needle || !closed.includes(root.path)} onClick={() => setClosed(current => current.includes(root.path) ? current.filter(path => path !== root.path) : [...current, root.path])}><SidebarIcon name={needle || !closed.includes(root.path) ? "down" : "right"} /><span>{root.path}</span></Button><Button variant="ghost" size="sm" className="tag-demo-group-count" onClick={() => setSelected(root.path)}>{root.count} 篇笔记</Button></div>
      {(needle || !closed.includes(root.path)) && <div className="tag-demo-chips">{children.map(item => chip(item))}</div>}
    </section>;
  };
  return <div className="ui-theme tag-demo" data-ui-theme="light">
    {sidebar && <aside className="tag-demo-sidebar" aria-label="Demo 侧边栏">
      <div className="tag-demo-brand"><Button variant="ghost" size="icon" aria-label="收起侧边栏" onClick={() => setSidebar(false)}><img src="/favicon.png" alt="" /></Button><strong>MemoCard</strong></div>
      <nav aria-label="预览导航"><span><SidebarIcon name="search" />搜索</span><span><SidebarIcon name="add" />新建笔记</span><span><SidebarIcon name="home" />主页</span><span><SidebarIcon name="notebook" />所有笔记</span><span className="tag-demo-nav-current"><SidebarIcon name="hash" />标签</span></nav>
      <p className="tag-demo-sidebar-label">置顶标签</p>{pinned.map(path => <Button key={path} variant="ghost" className="tag-demo-sidebar-tag" onClick={() => setSelected(path)}><span aria-hidden="true">{tags.find(item => item.path === path)?.icon || "#"}</span><span>{path}</span></Button>)}
      <p className="tag-demo-sidebar-label">标签</p>{roots.map(item => <Button key={item.path} variant="ghost" className="tag-demo-sidebar-tag" onClick={() => { if (variant === "A" && tags.some(child => child.path.startsWith(item.path + "/"))) navigate(item.path); else { setQuery(item.path); setSelected(""); } }}><SidebarIcon name="hash" />{item.path}</Button>)}
    </aside>}
    <main className={cn("tag-demo-main", variant === "B" && "tag-demo-main-alphabet")}>
      <header className="tag-demo-header">{!sidebar && <Button variant="ghost" size="icon" aria-label="展开侧边栏" onClick={() => setSidebar(true)}><img src="/favicon.png" alt="" className="size-8" /></Button>}<h1>标签</h1><span className="tag-demo-prototype-label">布局 Demo</span></header>
      {variant === "B" && <p className="tag-demo-alphabet-description">按字母浏览所有标签</p>}
      <div className="tag-demo-toolbar"><div className="tag-demo-search"><SidebarIcon name="search" /><Input aria-label="搜索标签" placeholder={(variant === "A" || variant === "D" || variant === "E") ? "搜索所有层级的标签" : "搜索标签"} value={query} onChange={event => setQuery(event.target.value)} />{query && <Button variant="ghost" size="icon-xs" aria-label="清空搜索" onClick={() => setQuery("")}><SidebarIcon name="close" /></Button>}</div>{variant === "A" ? <span className="tag-demo-total">共 {tags.length} 个标签</span> : variant === "D" && !needle ? <Button variant="outline" className="bg-surface dark:bg-surface" onClick={() => setOpened([])} disabled={!opened.length}>全部收起</Button> : variant === "C" && <Button variant="outline" className="bg-surface dark:bg-surface" onClick={() => setClosed(closed.length ? [] : parentGroups.map(item => item.path))} disabled={!!needle}>{closed.length ? "全部展开" : "全部收起"}</Button>}</div>
      {needle ? <p className="tag-demo-meta">找到 {matches.length} 个标签</p> : variant !== "B" && variant !== "E" && <section className="tag-demo-pinned" aria-label="置顶标签"><div className="tag-demo-section-heading"><HugeiconsIcon icon={PinIcon} aria-hidden="true" /><h2>置顶标签</h2><span>{pinned.length}</span></div><div className="tag-demo-chips">{pinned.map(path => chip(tags.find(item => item.path === path)!, true))}{!pinned.length && <p className="tag-demo-meta">点击标签右侧的图钉，将常用标签放在这里。</p>}</div></section>}
      {(variant === "C" || variant === "E") && <div className="tag-demo-section-heading tag-demo-all-heading"><h2>{needle ? "搜索结果" : "全部标签"}</h2><span>{matches.length}</span></div>}
      <div className={cn("tag-demo-directory", variant === "A" && "tag-demo-hierarchy", variant === "B" && "tag-demo-index", variant === "C" && "tag-demo-cards", variant === "D" && "tag-demo-inline", variant === "E" && "tag-demo-flat")}>
        {variant === "E" ? rootLetters.filter(initial => matches.some(item => rootLetter(item) === initial)).map(initial => <section key={initial} aria-labelledby={`tag-demo-flat-letter-${initial}`}><h2 id={`tag-demo-flat-letter-${initial}`} className="tag-demo-letter">{initial}</h2><div className="tag-demo-chips">{matches.filter(item => rootLetter(item) === initial).sort((a, b) => alphabetical.compare(a.path, b.path)).map(item => chip(item))}</div></section>) : variant === "D" ? needle ? <div className="tag-demo-chips">{matches.map(item => chip(item, true))}</div> : rootLetters.map(initial => <section key={initial} aria-labelledby={`tag-demo-root-letter-${initial}`}><h2 id={`tag-demo-root-letter-${initial}`} className="tag-demo-letter">{initial}</h2>{tree(roots.filter(item => letter(item) === initial).sort((a, b) => alphabetical.compare(a.path, b.path)))}</section>) : variant === "A" ? <><div className="tag-demo-directory-heading">{needle ? <h2>搜索结果</h2> : <nav aria-label="标签路径"><ol><li><Button variant="ghost" className="tag-demo-crumb" aria-current={!path ? "page" : undefined} onClick={() => navigate("")}>全部标签</Button></li>{pathParts.map((part, index) => <li key={index}><SidebarIcon name="right" /><Button variant="ghost" className="tag-demo-crumb" aria-current={index === pathParts.length - 1 ? "page" : undefined} onClick={() => navigate(pathParts.slice(0, index + 1).join("/"))}>{part}</Button></li>)}</ol></nav>}<span>{visible.length} 个标签</span></div><div className="tag-demo-chips">{visible.map(item => chip(item, !!needle))}</div></> : variant === "B" ? letters.map(initial => <section key={initial} aria-labelledby={`tag-demo-letter-${initial === "#" ? "other" : initial}`}><h2 id={`tag-demo-letter-${initial === "#" ? "other" : initial}`} className="tag-demo-letter">{initial}</h2><div className="tag-demo-chips">{matches.filter(item => letter(item) === initial).sort((a, b) => alphabetical.compare(tagName(a), tagName(b)) || alphabetical.compare(a.path, b.path)).map(item => chip(item))}</div></section>) : <>{parentGroups.map(group)}{looseTags.some(item => matches.includes(item)) && <section className="tag-demo-group"><h3 className="tag-demo-other-heading">其他标签</h3><div className="tag-demo-chips">{looseTags.filter(item => matches.includes(item)).map(item => chip(item))}</div></section>}</>}
        {!matches.length && <div className="tag-demo-empty"><p>没有找到相关标签</p><Button variant="outline" onClick={() => setQuery("")}>清空搜索</Button></div>}
      </div>
      <p className="tag-demo-selection" role="status">{selected ? `已选择 ${selected} · ${tags.find(item => item.path === selected)?.count} 篇笔记` : (variant === "B" || variant === "E") ? "示例数据 · 点击标签可预览完整路径" : "示例数据 · 搜索、选择和置顶仅在此 Demo 内生效"}</p>
    </main>
    <div className="tag-demo-switcher" role="group" aria-label="切换 Demo 布局"><Button variant="ghost" size="icon-sm" aria-label="上一个布局" onClick={() => cycle(-1)}><SidebarIcon name="right" className="rotate-180" /></Button><span><small>DEMO {variants.indexOf(variant) + 1} / {variants.length}</small><strong>{labels[variant]}</strong></span><Button variant="ghost" size="icon-sm" aria-label="下一个布局" onClick={() => cycle(1)}><SidebarIcon name="right" /></Button></div>
  </div>;
}
