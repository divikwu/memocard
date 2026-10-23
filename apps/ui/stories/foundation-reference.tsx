import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { radiusValues, sidebarTokens, spacingValues } from "../src/generated/design-tokens";
import { ControlSizeRows } from "./foundation-sizing.example";
import { motionCases, motionDurationTokens, motionEasingTokens, reducedMotionRules } from "./foundation-motion.data";
import { MotionExample } from "./foundation-motion.example";
import { SpacingPreview, WebSpacingBase, WebSpacingRows } from "./foundation-spacing.example";
import { FontChoiceRows, TypographySizeBase, TypographyScaleRows, TextRoleRows } from "./foundation-typography.example";
import { catalog, colorTokenGroups, dropShadowScale, foundationPages, foundationSections, insetShadowScale, projectIcons, shadowScale, type CSSToken, type FoundationCategory, type SectionId } from "./foundation-reference.data";
import { useFoundationValues, type FoundationSamples } from "./foundation-reference.samples";
import "./foundation-reference.css";

type Mode = "light" | "dark";

function ReferenceTable({ label, columns, children }: { label: string; columns: string[]; children: ReactNode }) {
  return <div className="foundation-table-wrap"><table className="foundation-table" aria-label={label}>
    <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody>
  </table></div>;
}

function ColorValue({ name, mode, value }: { name: string; mode: Mode; value?: string }) {
  return <span className="foundation-color-value" aria-label={`${name} ${mode} value`} data-color-mode={mode}>
    <span className="foundation-swatch" aria-hidden="true" style={{ backgroundColor: value }} />
    <code>{value || "读取中…"}</code>
  </span>;
}

function ShadowValue({ value, kind = "box" }: { value?: string; kind?: "box" | "drop" }) {
  return <div className="foundation-value-preview foundation-shadow-value"><code>{value || "读取中…"}</code>{kind === "drop"
    ? <svg aria-hidden="true" focusable="false" viewBox="0 0 64 40" className="foundation-shadow-preview foundation-drop-shadow-preview" style={{ filter: value ? `drop-shadow(${value})` : undefined }}><path d="M10 4h30l14 14v18H10Z" fill="var(--popover)" /></svg>
    : <span aria-hidden="true" className="foundation-shadow-preview" style={{ boxShadow: value }} />}</div>;
}

function CSSTable({ tokens, samples, label }: { tokens: CSSToken[]; samples: FoundationSamples; label: string }) {
  return <ReferenceTable label={label} columns={["Token", tokens.every(token => token.category === "typography") ? "Value" : `Value · ${samples.mode}`]}>{tokens.map(token => <tr key={token.name} data-token-kind="css" data-token-name={token.name} data-token-status={token.status}>
    <th scope="row"><code>{token.name}</code></th>
    <td>{token.type === "color" ? <ColorValue name={token.name} mode={samples.mode} value={samples.values[token.name]} />
      : token.type === "shadow" ? <ShadowValue value={samples.values[token.name]} /> : <div className="foundation-value-preview"><code>{samples.values[token.name] || "读取中…"}</code>{token.category === "shape" ? <span aria-hidden="true" className="foundation-radius-preview" style={{ borderRadius: samples.values[token.name] }} /> : null}</div>}</td>
  </tr>)}</ReferenceTable>;
}

function PortableTable({ category, inlinePreview = false }: { category: string; inlinePreview?: boolean }) {
  const values: Record<string, Record<string, number>> = { spacing: spacingValues, radius: radiusValues, sidebar: sidebarTokens };
  return <ReferenceTable label={`${category} portable dimensions`} columns={inlinePreview ? ["Token", "Value"] : ["Token", "Value", "Preview"]}>{catalog.portable.filter(token => token.category === category).map(token => {
    const [group, key] = token.name.split("."), value = values[group][key];
    return <tr key={token.name} data-token-kind="portable" data-token-name={token.name}>
      <th scope="row"><code>{token.name}</code></th>
      <td>{inlinePreview ? <span className="foundation-spacing-value"><SpacingPreview value={`${value}px`} /><code>{value}px / pt</code></span> : <code>{value}px / pt</code>}</td>
      {!inlinePreview && <td>{category === "shape" ? <span aria-hidden="true" className="foundation-radius-preview" style={{ borderRadius: value }} /> : <span className="foundation-dimension-preview" aria-label={`${token.name} ${value}`}><span style={{ width: value }} /></span>}</td>}
    </tr>;
  })}</ReferenceTable>;
}

function ShapeCurrentTable({ samples }: { samples: FoundationSamples }) {
  const tokens = catalog.css.filter(token => token.category === "shape");
  const levels = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];
  const groups = [tokens.filter(token => token.name.startsWith("--radius-")).sort((a, b) => levels.indexOf(a.name.slice(9)) - levels.indexOf(b.name.slice(9))), tokens.filter(token => token.name.includes("radius") && !token.name.startsWith("--radius-")), tokens.filter(token => !token.name.includes("radius"))];
  return <><p className="foundation-note">当前基准：<code aria-label="当前圆角基准">--radius = {samples.values["--radius-lg"] || "读取中…"}</code></p><ReferenceTable label="shape CSS definitions" columns={["Token", "Value", "Preview"]}>{groups.map((group, index) => <Fragment key={index}>
    {index === 1 && <tr className="foundation-table-group"><td colSpan={3}>交互区域圆角 · 独立规则</td></tr>}
    {index === 2 && <tr className="foundation-table-group"><td colSpan={3}>边框宽度</td></tr>}
    {group.map(token => <tr key={token.name} data-token-kind="css" data-token-name={token.name} data-token-status={token.status}>
      <th scope="row"><code>{token.name}</code></th>
      <td><code>{samples.values[token.name] || "读取中…"}</code>{index === 0 && <code className="foundation-radius-formula">{token.declarations[0].value}</code>}</td>
      <td><span aria-hidden="true" className="foundation-radius-preview" style={index === 2 ? { borderWidth: samples.values[token.name], borderStyle: "solid", borderRadius: 0 } : { borderRadius: samples.values[token.name] }} /></td>
    </tr>)}
  </Fragment>)}</ReferenceTable></>;
}

function ShadowScale({ mode }: { mode: Mode }) {
  return <>{[
    { title: "基础阴影", label: "Tailwind shadow scale", tokens: shadowScale, kind: "box" },
    { title: "内阴影", label: "Tailwind inset shadow scale", tokens: insetShadowScale, kind: "box" },
    { title: "轮廓投影", label: "Tailwind drop shadow scale", tokens: dropShadowScale, kind: "drop" },
  ].map(scale => <div key={scale.label}><h3>{scale.title}</h3><ReferenceTable label={scale.label} columns={["Token", `Value · ${mode}`]}>
    {scale.tokens.map(token => <tr key={token.name} data-token-kind="upstream" data-token-name={token.name}>
      <th scope="row"><code>{token.name}</code></th>
      <td><ShadowValue value={token.value} kind={scale.kind === "drop" ? "drop" : "box"} /></td>
    </tr>)}
  </ReferenceTable></div>)}</>;
}

function TypographyPreview({ samples }: { samples: FoundationSamples }) {
  return <div className="foundation-type-preview" aria-label="字体角色样本"><ReferenceTable label="typography CSS definitions" columns={["Token", "Value"]}>{catalog.css.filter(token => token.category === "typography" && token.type === "fontFamily" && token.layer !== "adapter").map(token => <tr key={token.name} data-token-kind="css" data-token-name={token.name} data-token-status={token.status}>
    <th scope="row"><code>{token.name}</code></th>
    <td><code>{samples.values[token.name] || "读取中…"}</code><span className="foundation-font-role" data-font-token={token.name} style={{ fontFamily: `var(${token.name})` }}>中文 Aa · MemoCard 0123</span></td>
  </tr>)}</ReferenceTable></div>;
}

function SectionContent({ id, samples, category }: { id: SectionId; samples: FoundationSamples; category: FoundationCategory }) {
  const css = (tokens: CSSToken[]) => <CSSTable tokens={tokens} samples={samples} label={`${id} CSS definitions`} />;
  const examples = category !== "all";
  const colorGroup = category === "colors" && colorTokenGroups.find(group => group.id === id);
  if (colorGroup) return css(colorGroup.names.map(name => catalog.css.find(token => token.name === name)!));
  switch (id) {
    case "colors": return css(colorTokenGroups.flatMap(group => group.names.map(name => catalog.css.find(token => token.name === name)!)));
    case "tags": return css(catalog.css.filter(token => token.id.startsWith("color.tags")));
    case "callouts": return css(catalog.css.filter(token => ["color.callouts", "color.callout-text", "color.callout-swatch"].includes(token.id)));
    case "palettes": return css(catalog.css.filter(token => ["color.ramps", "color.swatches"].includes(token.id)));
    case "spacing-web": return <><WebSpacingBase /><ReferenceTable label="Web spacing scale" columns={["Token", "Value"]}><WebSpacingRows /></ReferenceTable></>;
    case "spacing": return <PortableTable category="spacing" inlinePreview={category === "spacing"} />;
    case "sizing": return <>{examples && <><h3>Web 控件尺寸</h3><p className="foundation-section-description">样本直接使用生产组件，数值读取当前实际尺寸，随根字号更新。文字按钮与纯图标按钮分别展示；输入框在移动端保留较大的字号。控件密度与移动端命中区分别管理。</p><ReferenceTable label="Web control dimensions" columns={["Component / Size", "Value · Preview"]}><ControlSizeRows /></ReferenceTable><h3>跨端侧栏基准</h3><p className="foundation-section-description">下表保留逻辑基准（Web px / 原生 pt），并非所有常量在两端都直接使用。Web 桌面行默认 32px，移动行最小 48px，文字放大时行高随内容增长；移动展开按钮的视觉框 40px、命中区 44px 分开保留。原生文字与行高遵循 Dynamic Type。</p></>}{css(catalog.css.filter(token => token.category === "sizing" && token.layer !== "adapter"))}<PortableTable category="sizing" inlinePreview={examples} /></>;
    case "shape": return <><PortableTable category="shape" />{category === "all" && <><h3>当前主题圆角</h3><ShapeCurrentTable samples={samples} /></>}</>;
    case "shape-current": return <ShapeCurrentTable samples={samples} />;
    case "elevation": return <>{examples && <><ShadowScale mode={samples.mode} /><h3>项目定义</h3></>}{css(catalog.css.filter(token => token.category === "effects" && token.layer !== "adapter"))}</>;
    case "typography": return examples ? <><TypographySizeBase /><ReferenceTable label="Typography text roles" columns={["文字样式", "字号 / 字重 / 行高"]}><TextRoleRows /></ReferenceTable></> : css(catalog.css.filter(token => token.category === "typography" && token.layer !== "adapter"));
    case "typography-fonts": return <><TypographyPreview samples={samples} /><h3>可选字体样本</h3><ReferenceTable label="Typography font choices" columns={["字体", "预览"]}><FontChoiceRows /></ReferenceTable></>;
    case "typography-size": return <ReferenceTable label="Typography size scale" columns={["Token", "Value", "Example"]}><TypographyScaleRows scale="size" /></ReferenceTable>;
    case "typography-weight": return <ReferenceTable label="Typography weights" columns={["Token", "Value"]}><TypographyScaleRows scale="weight" /></ReferenceTable>;
    case "typography-leading": return <ReferenceTable label="Typography leading" columns={["Token", "倍数 / 预览"]}><TypographyScaleRows scale="leading" /></ReferenceTable>;
    case "motion": return category === "all" ? css(catalog.css.filter(token => token.category === "motion" && token.layer !== "adapter")) : <>
      <p>动效帮助理解状态与空间变化。时长和缓动统一读取生产 token，保留现有表现；进入方向、动画属性和手势阈值仍由组件维护。</p>
      <h3>Duration</h3>
      <ReferenceTable label="Motion duration tokens" columns={["Token", "Value"]}>{motionDurationTokens.map(token => <tr key={token.name}><th scope="row"><code>{token.name}</code></th><td><code>{samples.values[token.name] || token.declarations[0].value}</code></td></tr>)}</ReferenceTable>
      <h3>Easing</h3>
      <ReferenceTable label="Motion easing tokens" columns={["Token", "Value"]}>{motionEasingTokens.map(token => <tr key={token.name}><th scope="row"><code>{token.name}</code></th><td><code>{samples.values[token.name] || token.declarations[0].value}</code></td></tr>)}</ReferenceTable>
      <h3>场景与 token</h3>
      <ReferenceTable label="Motion reference" columns={["场景", "时长 / 缓动", "Token"]}>{motionCases.map(item => <tr key={item.name}><th scope="row">{item.name}</th><td><code>{item.duration}</code><br /><code>{item.easing}</code></td><td><code>{item.durationToken}</code><br /><code>{item.easingToken}</code></td></tr>)}</ReferenceTable>
      <h3>使用方式</h3>
      <p>普通控件继续使用 <code>transition-colors</code> 或指定过渡属性，默认读取 fast / standard。面板使用 <code>duration-(--motion-duration-panel)</code>，浮层动画使用 <code>animation-duration-(--motion-duration-fast)</code>。自定义 CSS 直接引用：</p>
      <pre aria-label="动效 token CSS 用法" tabIndex={0} className="overflow-x-auto rounded-lg border border-border p-4 outline-none focus-visible:focus-ring"><code style={{ whiteSpace: "pre", overflowWrap: "normal" }}>{`.surface {
  transition: box-shadow
    var(--motion-duration-normal)
    var(--motion-ease-out);
}`}</code></pre>
      <p>CSS 的 <code>--motion-ease-out: ease-out</code> 与 Tailwind 的 <code>ease-out</code> 工具类是不同曲线。既有界面不混用；高频悬停不增加等待，动画不阻塞操作，也不为已有即时变化新增动画。</p>
      <h3>减少动态效果</h3>
      <ReferenceTable label="Reduced motion rules" columns={["范围", "行为"]}>
        <tr><th scope="row">全局动画 / 过渡</th><td><code>{reducedMotionRules.animation} / {reducedMotionRules.transition}</code></td></tr>
        <tr><th scope="row">平滑滚动</th><td><code>{reducedMotionRules.scroll}</code></td></tr>
        <tr><th scope="row">快速记录 / 手势回弹过渡</th><td><code>{reducedMotionRules.capture} / {reducedMotionRules.swipe}</code></td></tr>
        <tr><th scope="row">图片加载动画</th><td><code>{reducedMotionRules.image}</code></td></tr>
      </ReferenceTable>
      <MotionExample compact />
    </>;
    case "icons": return <div className="foundation-icon-grid">{projectIcons.map(icon => <div key={icon.name}><span aria-hidden="true" style={{ maskImage: `url(${JSON.stringify(`data:image/svg+xml,${encodeURIComponent(icon.svg)}`)})` }} /><code>{icon.name}</code></div>)}</div>;
  }
}

export function FoundationReference({ category = "all" }: { category?: FoundationCategory }) {
  const page = foundationPages[category], samples = useFoundationValues();
  const sections = page.sections.map(id => {
    const section = foundationSections.find(section => section.id === id)!;
    if (category === "colors" && id === "colors") return { ...section, title: colorTokenGroups[0].title, description: colorTokenGroups[0].description };
    if (category === "spacing" && id === "spacing") return { ...section, title: "跨端间距基准", description: "六项固定逻辑基准：Web 使用 px，原生使用 pt。横条按 Web 的实际尺寸展示，不与 rem 标尺合并。" };
    if (category === "sizing") return { ...section, title: "尺寸与密度", description: "控件实际尺寸与跨端侧栏基准分开展示，区分文字容纳空间、图标视觉尺寸与触摸命中区。" };
    if (category === "typography" && id === "typography") return { ...section, title: "通用文字样式", description: "八种通用样式组合字号、字重与行高。组件按用途消费，笔记阅读设置作为独立倍率应用。" };
    if (category === "icons") return { ...section, title: "项目图标" };
    if (category === "motion") return { ...section, title: "动效规范" };
    if (category === "elevation") return { ...section, title: "阴影与透明度", description: "基础、内阴影与轮廓投影使用上游标尺；项目定义单独列出。" };
    return category === "shape" && id === "shape" ? { ...section, title: "圆角选项", description: "工具栏可选的七个固定档位，预览保持各自的圆角大小。" } : section;
  });
  const root = useRef<HTMLElement>(null), [active, setActive] = useState<string>(sections[0].id);
  useEffect(() => {
    const headings = [...root.current!.querySelectorAll("section[id]")];
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      let current = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > innerHeight * .15) break;
        current = heading;
      }
      setActive(current.id.replace("foundation-", ""));
    };
    const schedule = () => { frame ??= requestAnimationFrame(update); };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => { removeEventListener("scroll", schedule); removeEventListener("resize", schedule); if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [category]);
  return <main ref={root} className="foundation-document sb-unstyled" data-foundation-page={category} data-token-mode={samples.mode} aria-busy={!Object.keys(samples.values).length}>
    <header className="foundation-header"><p className="foundation-eyebrow">Foundations</p><h1>{page.title}</h1><p className="foundation-lead">{page.description}</p>
      {category === "all" && <p className="foundation-meta">{catalog.css.filter(token => token.layer !== "adapter").length} 项基础 CSS 定义 · {catalog.portable.length} 项尺寸基准</p>}
    </header>
    <nav className="foundation-toc" aria-label="本页内容"><span>On this page</span><ul>{sections.map(section => <li key={section.id}><a href={`#foundation-${section.id}`} target="_self" aria-current={active === section.id ? "location" : undefined} onClick={() => setActive(section.id)}>{section.title}</a></li>)}</ul></nav>
    <div className="foundation-body">{sections.map(section => <section key={section.id} id={`foundation-${section.id}`} aria-labelledby={`foundation-title-${section.id}`}>
      <h2 id={`foundation-title-${section.id}`}>{category === "typography" && section.id === "typography" && <span id="foundation-typography-notes" aria-hidden="true"><span id="foundation-title-typography-notes" /></span>}<a href={`#foundation-${section.id}`} target="_self">{section.title}</a></h2><p className="foundation-section-description">{section.description}</p><SectionContent id={section.id} samples={samples} category={category} />
    </section>)}</div>
  </main>;
}
