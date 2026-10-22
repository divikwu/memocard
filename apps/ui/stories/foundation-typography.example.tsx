import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import usage from "../../../design/typography-usage.generated.json";
import catalog from "../../../design/token-coverage.generated.json";
import { FONT_FAMILIES, type FontChoice } from "../src/lib/font-options";
import { FONT_GROUPS } from "../src/lib/font-groups";
import { loadFonts } from "../src/features/theme/font-loader";
import { defaults, options } from "../src/features/typography/preferences";
import { fontSizes, fontWeights, textStyles, lineHeights, type FontSize } from "../src/features/typography/scale";
import "../src/typeset.css";

type Property = "font-family" | "font-size" | "font-weight" | "line-height";
const styleProperties = { "font-family": "fontFamily", "font-size": "fontSize", "font-weight": "fontWeight", "line-height": "lineHeight" } as const;
const localSizeVariables = new Set(usage.entries.filter(entry => entry.property === "font-size").flatMap(entry => entry.locations.flatMap(location => "variable" in location && location.scope !== ":root" ? [location.variable] : [])));

function TypeSpecimen({ property, value, onSize }: { property: Property; value: string; onSize?: (pixels: string | undefined) => void }) {
  const root = useRef<HTMLDivElement>(null), [contextual, setContextual] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const computed = getComputedStyle(root.current!);
      const references = value.matchAll(property === "font-size" ? /var\(\s*(--[\w-]+)/g : /var\((--[\w-]+)\)/g);
      const missing = [...references].some(([, name]) => !computed.getPropertyValue(name).trim() || (property === "font-size" && localSizeVariables.has(name)));
      setContextual(missing);
      if (onSize) {
        const probe = document.createElement("span");
        probe.style.fontSize = value;
        root.current!.append(probe);
        onSize(missing ? undefined : getComputedStyle(probe).fontSize);
        probe.remove();
      }
    };
    measure();
    if (!onSize) return;
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [property, value, onSize]);
  const style: CSSProperties = { fontFamily: "var(--app-font-body)", fontSize: "inherit", fontWeight: "normal", lineHeight: defaults.leading, [styleProperties[property]]: value };
  return <div ref={root} hidden={Boolean(onSize && contextual)} className="foundation-typography-context markdown typeset" style={{ fontSize: `${defaults.size}px` }}>
    {contextual ? <span className="foundation-context-note">随组件上下文解析</span> : property === "line-height" && value === "0" ? <span className="foundation-context-note">零行盒 · 用于上下标等局部样式</span>
      : <span className="foundation-typography-specimen" data-type-property={property} data-type-value={value} style={style}>{property === "font-family" && value.includes("Emoji") ? "📝 🙂 ☕" : "中文 Aa 0123"}{property === "line-height" && <><br />保持清晰阅读</>}</span>}
  </div>;
}

export function TypographySizeBase() {
  const [rootSize, setRootSize] = useState<string>();
  useLayoutEffect(() => {
    const measure = () => setRootSize(getComputedStyle(document.documentElement).fontSize);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);
  return <p className="foundation-note" data-typography-size-basis>预览基准：根字号 <code>{rootSize ?? "…"}</code>；父级字号 <code>{defaults.size}px</code>。统一字号随根字号缩放；阅读偏好作为基准字号的倍率，页面宽度保留现有计算。</p>;
}

export const textRoles = Object.keys(textStyles) as (keyof typeof textStyles)[];
const roleLabels: Record<string, string> = { title: "页面标题", heading: "大标题", subheading: "小标题", large: "大正文", body: "正文", label: "标签与控件", supporting: "辅助文字", code: "代码" };

function TextRoleRow({ role }: { role: typeof textRoles[number] }) {
  const sample = useRef<HTMLSpanElement>(null), [metrics, setMetrics] = useState<string[]>([]);
  useLayoutEffect(() => {
    const measure = () => { const style = getComputedStyle(sample.current!); setMetrics([style.fontSize, style.fontWeight, style.lineHeight].map(value => value.endsWith("px") ? `${Math.round(parseFloat(value) * 100) / 100}px` : value)); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);
  const names = ["size", "weight", "leading"].map(property => `--text-${role}-${property}`);
  const fontFamily = role === "code" ? "var(--note-mono-font)" : /title|heading/.test(role) ? "var(--note-heading-font)" : "var(--app-font-body)";
  return <tr data-text-role={role}>
    <th scope="row"><span className="foundation-font-availability">{roleLabels[role] ?? `内容标题 H${role.at(-1)}`}</span><div className="foundation-role-context" style={{ fontSize: `${defaults.size}px` }}><span ref={sample} className="foundation-role-sample" data-role-sample={role} style={{ fontFamily, fontSize: `var(${names[0]})`, fontWeight: `var(${names[1]})`, lineHeight: `var(${names[2]})` }}>中文 Aa 0123</span></div></th>
    <td><code data-role-metrics>{metrics.join(" / ")}</code>{names.map(name => <span key={name} data-token-kind="css" data-token-name={name} className="foundation-typography-source"><code>{name}</code><br /><code>{catalog.css.find(token => token.name === name)!.declarations[0].value}</code></span>)}</td>
  </tr>;
}

export function TextRoleRows() { return textRoles.map(role => <TextRoleRow key={role} role={role} />); }

function SizeScaleRow({ name, value }: { name: FontSize; value: number }) {
  const [pixels, setPixels] = useState<string>();
  const token = `--font-size-${name}`;
  return <tr data-type-scale="size" data-scale-name={token} data-token-kind="css" data-token-name={token}>
    <th scope="row"><code>{token}</code></th><td><code>{value}rem</code><span className="foundation-font-availability" data-typography-pixels>{pixels ?? "…"}</span></td>
    <td><TypeSpecimen property="font-size" value={`var(${token})`} onSize={setPixels} /></td>
  </tr>;
}

export function TypographyScaleRows({ scale }: { scale: "size" | "weight" | "leading" }) {
  if (scale === "size") return (Object.entries(fontSizes) as [FontSize, number][]).map(([name, value]) => <SizeScaleRow key={name} name={name} value={value} />);
  if (scale === "leading") return Object.entries(lineHeights).map(([name, value]) => <tr key={name} data-type-scale="leading" data-scale-name={`--leading-${name}`} data-token-kind="css" data-token-name={`--leading-${name}`}>
    <th scope="row"><code>--leading-{name}</code></th><td><code>{value}</code><span className="foundation-font-availability">{{ tight: "紧凑 · 标题", normal: "标准 · 界面文字", relaxed: "宽松 · 长文阅读" }[name]}</span><span className="foundation-font-role" style={{ fontSize: "var(--font-size-base)", lineHeight: `var(--leading-${name})` }}>中文 Aa 0123<br />保持清晰阅读</span></td>
  </tr>);
  return Object.entries(fontWeights).map(([name, value]) => <tr key={name} data-type-scale="weight" data-token-kind="css" data-token-name={`--font-weight-${name}`}><th scope="row"><code>--font-weight-{name}</code></th><td><code>{value}</code><span className="foundation-font-role" style={{ fontWeight: `var(--font-weight-${name})` }}>中文 Aa 0123</span></td></tr>);
}

function FontChoiceRow({ font, group }: { font: { value: FontChoice; label: string }; group: string }) {
  const row = useRef<HTMLTableRowElement>(null), [status, setStatus] = useState("idle");
  useEffect(() => {
    let current = true;
    const observer = new IntersectionObserver(entries => {
      if (!current || !entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setStatus("loading");
      void loadFonts([font.value]).then(() => current ? document.fonts.load(`16px ${FONT_FAMILIES[font.value]}`, "中文 Aa · MemoCard 0123") : undefined)
        .then(() => { if (current) setStatus("ready"); }).catch(() => { if (current) setStatus("fallback"); });
    }, { rootMargin: "160px" });
    observer.observe(row.current!);
    return () => { current = false; observer.disconnect(); };
  }, [font.value]);
  return <tr ref={row} data-font-choice={font.value} data-font-state={status}>
    <th scope="row">{font.label}<span className="foundation-font-availability">{group} · {options.body.includes(font.value) ? "界面 / 笔记" : "界面"}</span></th>
    <td><span className="foundation-font-choice" style={status === "ready" ? { fontFamily: FONT_FAMILIES[font.value] } : undefined}>中文 Aa · MemoCard 0123</span>
      {status === "loading" && <span className="foundation-font-availability" role="status">加载中…</span>}
      {status === "fallback" && <span className="foundation-font-availability" role="status">加载失败，使用回退字体。</span>}
    </td>
  </tr>;
}

export function FontChoiceRows() {
  return FONT_GROUPS.flatMap(group => group.options.map(font => <FontChoiceRow key={font.value} font={font} group={group.label} />));
}
