import { useEffect, useRef, useState, type ReactNode } from "react";
import { aliases, categories, sourceRef, textStyles, tokens, utilities, type ThemeToken, type TokenCategory } from "./token-catalog";
import { bestPractices, contentTitles, FoundationContent, overview, usage, type ContentSection, type GuidanceRule } from "./foundation-content";
import { usePreviewAppearance, usePreviewGlobalsParam } from "./preview-mode";
import "./token-page.css";

type Section = { id: string; title: string; description?: string; rows?: ThemeToken[]; content?: ReactNode };
type TextMetrics = { size: string; weight: string; leading: string; family: string };
type Measurements = { values: Record<string, string>; spacing: Record<string, { px: string; rem: string }>; text: Record<string, TextMetrics> };
const spacingSteps = [0, .5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const readablePixels = (value: string) => `${Number(parseFloat(value).toFixed(2))}px`;
const isColor = (token: ThemeToken) => token.name.startsWith("--color-") || token.name === "--focus-outline-color";
const select = (prefix: string) => tokens.filter(token => token.name.startsWith(prefix));
const colorSections: Section[] = [
  { id: "colors", title: "Color Tokens", description: "通用颜色语义，包含表面、文字、图标、边框与状态。" },
  { id: "palette", title: "Hue Roles", description: "十个色系的背景、边框、图标与文字语义角色，分别引用基础色阶。" },
  { id: "syntax", title: "Syntax Tokens", description: "代码语法与差异高亮，引用与 color-mix 随主题解析。" },
  { id: "data", title: "Data Visualization Tokens", description: "分类颜色、连续色阶与中性色。" },
  { id: "brand", title: "Brand", description: "官方 Color 表未给出值，保留为待配置。" },
  { id: "extensions", title: "Project Extensions", description: "项目扩展角色覆盖控件底色、弱描边、状态填充与强调反馈，均引用基础色板并单独计数。" },
].map(section => ({ ...section, rows: tokens.filter(token => token.colorGroup === section.id) }));
const baseSections: Section[] = [
  { id: "spacing-base", title: "Spacing Base", rows: select("--spacing-").filter(token => token.name !== "--spacing-reading-flow") },
  { id: "sizes", title: "Size Tokens", rows: select("--size-") },
  { id: "border", title: "Border Tokens", rows: select("--border-") },
  { id: "focus", title: "Focus Tokens", rows: select("--focus-") },
  { id: "radius", title: "Radius Scale", rows: select("--radius-") },
  { id: "shadow-scale", title: "Shadow Scale", description: "0–4 是从平面到高浮起的五个递增等级，使用多层外投影表达高度。0 保留六层透明值；1 使用两层投影与一层 1px 外缘，2–4 使用五层投影与一层 1px 外缘，保留透明占位层以支持过渡。浅深色共用几何结构，分别设置各层透明度。组件通过语义角色引用；内侧高光、结构边框和焦点独立维护。", rows: select("--shadow-scale-") },
  { id: "shadows", title: "Component Roles", description: "组件使用与 token 同名的 shadow-flat / low / med / high 工具类，分别映射基础尺度 0 / 2 / 3 / 4。control 组合 1 与独立控件高光，floating 选择 2，document 选择 3。语义角色表达用途，基础尺度统一拥有投影数值。", rows: tokens.filter(token => ["--shadow-flat", "--shadow-low", "--shadow-med", "--shadow-high", "--shadow-control", "--shadow-floating", "--shadow-document"].includes(token.name)) },
  { id: "control-highlight", title: "Control Highlight", description: "控件的 1px 白色内侧高光单独维护：浅色 88%，深色 4%。shadow-control 将它与尺度 1 组合；高光不属于外投影高度，也不替代边框或键盘焦点。", rows: select("--surface-highlight-") },
  { id: "floating-edge", title: "Floating Surface Edge", description: "浮层默认组合 surface-floating shadow-high。投影配方包含 1px 外缘，surface-floating 保留透明布局边框，并在深色增加白色 4% 内侧高光，不再重复叠加外缘。显式使用 shadow-none 或 shadow-flat 时恢复普通边框；强制颜色模式保留系统色边界。输入、按钮的状态边框和键盘焦点独立维护。", rows: tokens.filter(token => ["--color-border-floating", "--surface-edge-floating"].includes(token.name)) },
  { id: "card-hover-shadow", title: "Card Hover", description: "PC 笔记卡片默认使用 flat（尺度 0）；悬停时 card-hover 选择 low（尺度 2），复用统一标尺。缩放与动效参数单独维护。", rows: tokens.filter(token => token.name === "--shadow-card-hover") },
  { id: "input-shadow", title: "Input Focus", description: "输入聚焦角色映射到 med。PC 快速记录默认使用 shadow-low，聚焦使用 --shadow-input-focus；H5 弹窗保持无投影。鼠标或触控聚焦只增强已有的表面反馈；Tab 导航进入输入控件时显示独立焦点框，鼠标进入后继续输入文字不会切换为键盘导航。单行、多行、复合、搜索、选择与 portal 输入共用页面级输入方式检测。", rows: tokens.filter(token => token.name === "--shadow-input-focus") },
  { id: "glass-blur", title: "Glass Blur", description: "页面顶部与底部毛玻璃遮罩的背景模糊半径；渐隐高度和表面颜色使用各自 token。", rows: select("--blur-") },
  { id: "state-rings", title: "Control State", description: "以下 2px 内环仅保留为预留变量，当前没有生产组件消费，也不导出 shadow-inset-* 工具类。它们不属于表面层级，不作为可与外投影组合的公开接口；实际状态反馈与键盘焦点分别维护。", rows: select("--shadow-inset-") },
  { id: "duration", title: "Duration", rows: select("--duration-") },
  { id: "easing", title: "Easing", rows: select("--ease-") },
  { id: "font-families", title: "Font Families", rows: select("--font-family-") },
  { id: "font-sizes", title: "Font Sizes", rows: select("--font-size-") },
  { id: "font-weights", title: "Font Weights", rows: select("--font-weight-") },
  { id: "line-height", title: "UI Line Height", rows: select("--text-").filter(token => token.name !== "--text-reading-leading") },
  { id: "reading-rhythm", title: "Reading Rhythm", description: "Typeset 内容区的阅读行高与相对段落间距，独立于 UI 行高及布局间距基准。", rows: tokens.filter(token => ["--text-reading-leading", "--spacing-reading-flow"].includes(token.name)) },
];

function TokenTable({ rows, values, mode, title, showUsage }: { rows: ThemeToken[]; values: Record<string, string>; mode: string; title: string; showUsage: boolean }) {
  const hasShadowPreview = rows.some(token => token.name.startsWith("--shadow-") || token.name.startsWith("--surface-edge-") || token.name.startsWith("--surface-highlight-"));
  return <div className="token-table-wrap" tabIndex={hasShadowPreview ? 0 : undefined} role={hasShadowPreview ? "region" : undefined} aria-label={hasShadowPreview ? `${title} 表格` : undefined}><table className="token-table" aria-label={`${title} definitions`}>
    <thead><tr><th scope="col">Token</th><th scope="col">Value · {mode}</th></tr></thead>
    <tbody>{rows.map(token => {
      const value = values[token.name];
      const definition = mode === "dark" ? token.dark : token.light;
      return <tr key={token.name} data-token-row={token.name} data-tailwind={token.interfaces.join(" ")} data-token-source={token.colorGroup ? token.projectExtension ? "project" : "astryx" : undefined} data-token-value-source={isColor(token) && !token.pending ? token.valueSource ?? "tailwind" : undefined} data-token-definition={isColor(token) && !token.pending ? definition : undefined} data-token-pending={token.pending || undefined}>
        <th scope="row"><code>{token.name}</code>{token.projectExtension && <span className="token-interface">项目扩展</span>}{showUsage && token.interfaces.length > 0 && <span className="token-interface">{token.interfaces.join(" · ")}</span>}</th>
        <td>{token.pending ? <span className="token-pending">待配置</span> : isColor(token) ? <><span className="token-color-value"><span aria-hidden="true" className="token-swatch" style={{ backgroundColor: value }} /><code>{value || "读取中…"}</code></span><span className="token-color-definition"><code>{definition}</code></span></>
          : <div className="token-value"><code>{value || "读取中…"}</code>
            {(token.name.startsWith("--shadow-") || token.name.startsWith("--surface-edge-") || token.name.startsWith("--surface-highlight-")) && <span aria-hidden="true" className="token-shadow-stage"><span className="token-shadow-preview" style={{ boxShadow: value }} /></span>}
            {token.name.startsWith("--radius-") && <span aria-hidden="true" className="token-radius-preview" style={{ borderRadius: value }} />}
            {token.name.startsWith("--font-family-") && <span className="token-font-preview" style={{ fontFamily: value }}>中文 Aa · MemoCard 0123</span>}
            {token.name.startsWith("--font-size-") && <span className="token-font-preview" style={{ fontSize: value }}>中文 Aa · MemoCard 0123</span>}
            {token.name.startsWith("--font-weight-") && <span className="token-font-preview" style={{ fontWeight: value }}>中文 Aa · MemoCard 0123</span>}
          </div>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function Practices({ rules }: { rules: GuidanceRule[] }) {
  return <div className="token-table-wrap"><table className="foundation-table foundation-practices token-table" aria-label="Best Practices">
    <thead><tr><th scope="col">Guidance</th><th scope="col">Practices</th></tr></thead>
    <tbody>{rules.map(rule => <tr key={rule.text}><th scope="row"><span className={`foundation-guidance-label foundation-guidance-${rule.kind}`}>{rule.kind === "do" ? "Do" : "Don't"}</span></th><td>{rule.text}</td></tr>)}</tbody>
  </table></div>;
}

function SpacingScale({ measurements }: { measurements: Measurements["spacing"] }) {
  return <div className="token-table-wrap"><table className="token-table" aria-label="Derived spacing scale">
    <thead><tr><th scope="col">Scale</th><th scope="col">Value · current root size</th></tr></thead>
    <tbody>{spacingSteps.map(step => <tr key={step} data-spacing-step={step}>
      <th scope="row"><code>gap-{step}</code><span className="token-interface">p-{step} · m-{step}</span></th>
      <td><span className="foundation-spacing-value"><code>{measurements[step]?.rem ?? "…"} · {measurements[step]?.px ?? "…"}</code><span aria-hidden="true" className="foundation-spacing-bar" style={{ width: `calc(var(--spacing-1) * ${step})` }} /></span></td>
    </tr>)}</tbody>
  </table></div>;
}

function TypeScale({ metrics }: { metrics: Measurements["text"] }) {
  return <div className="token-table-wrap"><table className="token-table foundation-type-scale" aria-label="Semantic type scale">
    <thead><tr><th scope="col">Style</th><th scope="col">Preview · computed metrics</th></tr></thead>
    <tbody>{textStyles.map(style => {
      const value = metrics[style.name];
      return <tr key={style.name} data-text-style={style.name}><th scope="row">{style.label}<span className="token-interface">{style.className}</span></th><td>
        <p className={style.className}>中文 Aa · MemoCard</p>
        <span className="token-interface" data-type-metrics data-font-size={value?.size} data-font-weight={value?.weight} data-line-height={value?.leading}>{value ? `${readablePixels(value.size)} · ${value.weight} · line-height ${readablePixels(value.leading)}` : "读取中…"}</span>
      </td></tr>;
    })}</tbody>
  </table></div>;
}

function pageSections(category: TokenCategory, measurements: Measurements, globalsParam: string): Section[] {
  const section = (id: string) => baseSections.find(item => item.id === id)!;
  const content = (id: ContentSection): Section => ({ id, title: contentTitles[id], content: <FoundationContent section={id} /> });
  const typeScale: Section = { id: "type-scale", title: "Type Scale", description: "十四个合成文字样式，字号、字重和行高读取真实渲染结果；不重复计入源变量。", content: <TypeScale metrics={measurements.text} /> };
  const spacingScale: Section = { id: "spacing-scale", title: "Scale", description: "十五档间距由同一基准派生，展示 rem 与当前 px；派生步阶不重复计入源定义。", content: <SpacingScale measurements={measurements.spacing} /> };
  let result: Section[];
  switch (category) {
    case "all": result = [...colorSections, ...baseSections]; break;
    case "colors": result = colorSections; break;
    case "elevation": result = [section("shadow-scale"), section("shadows"), { id: "components", title: "Light & Dark Preview", content: <p><a href={`/?path=/story/ui-elevation--components&globals=${globalsParam}`} target="_top">打开浅深色阴影标尺与真实组件对照</a></p> }, section("control-highlight"), section("floating-edge"), content("elevation-levels"), section("card-hover-shadow"), section("input-shadow"), section("glass-blur"), { id: "surface-border", title: "Surface Border", description: "普通描边与分隔线使用 --color-border 和 --color-divider。平面笔记卡片、移动端无投影输入面板使用 --color-border-subtle。浮起的卡片、快速记录和浮层使用投影内置的 1px 装饰外缘，实际边框保留透明占位，避免边缘叠加；结构分隔、错误状态和焦点描边继续使用各自角色。", rows: tokens.filter(token => ["--color-border", "--color-border-subtle", "--color-divider"].includes(token.name)) }, { id: "shadow-color", title: "Shadow Color", description: "外投影使用主题拥有的统一中性阴影基色；不提供 shadow-red-500 等自由染色接口。浅深色模式共用几何结构，分别定义透明度，保持一致的等级含义。控件高光使用独立角色。", rows: tokens.filter(token => token.name === "--color-shadow") }, section("state-rings")]; break;
    case "icons": result = [content("icon-usage")]; break;
    case "illustrations": result = [content("illustration-scenarios"), content("illustration-guidelines"), content("illustration-placement")]; break;
    case "motion": result = [section("duration"), section("easing"), content("motion-helps"), content("motion-hurts"), content("motion-preferences")]; break;
    case "shape": result = [section("radius"), content("concentric-radius")]; break;
    case "spacing": result = [spacingScale, section("spacing-base"), section("sizes")]; break;
    case "typography": result = [section("font-families"), section("font-sizes"), section("font-weights"), typeScale, section("line-height"), section("reading-rhythm"), { id: "typeset", title: "Content Typesetting", description: "控件与导航使用 type-*；HTML 和 Markdown 内容使用 Typeset，复用主题并独立控制阅读节奏。", content: <p><a href={`/?path=/docs/ui-typeset--docs&globals=${globalsParam}`} target="_top">打开 Typeset 内容预览、token 映射与使用边界</a></p> }]; break;
  }
  if (category !== "all") result = [{ id: "overview", title: "Overview", description: overview[category] }, ...result];
  if (usage[category]) result = [...result, { id: "usage", title: "Usage in Tailwind", description: category === "icons" ? "尺寸由宿主组件选择。仅图标控件提供 aria-label；装饰图形使用 aria-hidden，关键状态同时提供文字。" : "示例使用当前项目的工具类与交互基础。", content: <pre className="foundation-code"><code>{usage[category]}</code></pre> }];
  if (bestPractices[category]) result = [...result, { id: "best-practices", title: "Best Practices", content: <Practices rules={bestPractices[category]!} /> }];
  return result;
}

export function TokenPage({ category }: { category: TokenCategory }) {
  const { mode, radius, headingFont, bodyFont } = usePreviewAppearance();
  const globalsParam = usePreviewGlobalsParam();
  const root = useRef<HTMLElement>(null);
  const [measurements, setMeasurements] = useState<Measurements>({ values: {}, spacing: {}, text: {} });
  const [active, setActive] = useState("");
  const page = categories.find(item => item.id === category)!;
  const sections = pageSections(category, measurements, globalsParam);

  useEffect(() => {
    const document = root.current!.ownerDocument;
    let mounted = true;
    const update = () => {
      if (!mounted) return;
      const computed = getComputedStyle(root.current!);
      const holder = document.createElement("span");
      holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
      const sample = document.createElement("span");
      sample.style.display = "block";
      holder.append(sample);
      root.current!.append(holder);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
      const next: Measurements = { values: {}, spacing: {}, text: {} };
      for (const token of tokens) {
        if (token.pending) next.values[token.name] = "待配置";
        else if (isColor(token)) {
          sample.style.color = `var(${token.name})`;
          const color = getComputedStyle(sample).color;
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const rgba = [...context.getImageData(0, 0, 1, 1).data];
          next.values[token.name] = `#${rgba.slice(0, rgba[3] === 255 ? 3 : 4).map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
        } else if (/^--(font-size-|size-|radius-|spacing-)/.test(token.name) || /^--(border-width|focus-outline-width|focus-outline-offset)$/.test(token.name)) {
          sample.style.width = `var(${token.name})`;
          next.values[token.name] = getComputedStyle(sample).width;
        } else next.values[token.name] = computed.getPropertyValue(token.name).trim();
      }
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      for (const step of spacingSteps) {
        sample.style.width = `calc(var(--spacing-1) * ${step})`;
        const px = getComputedStyle(sample).width;
        next.spacing[step] = { px, rem: `${Number((parseFloat(px) / rootSize).toFixed(4))}rem` };
      }
      sample.removeAttribute("style");
      for (const style of textStyles) {
        sample.className = style.className;
        const css = getComputedStyle(sample);
        next.text[style.name] = { size: css.fontSize, weight: css.fontWeight, leading: css.lineHeight, family: css.fontFamily };
      }
      holder.remove();
      setMeasurements(next);
    };
    update();
    void document.fonts.ready.then(update);
    document.fonts.addEventListener("loadingdone", update);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.addEventListener("change", update);
    return () => { mounted = false; document.fonts.removeEventListener("loadingdone", update); reducedMotion.removeEventListener("change", update); };
  }, [mode, category, radius, headingFont, bodyFont]);

  useEffect(() => {
    const headings = [...root.current!.querySelectorAll<HTMLElement>("section[id]")];
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      let current = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > innerHeight * .15) break;
        current = heading;
      }
      setActive(current.id);
    };
    const schedule = () => { frame ??= requestAnimationFrame(update); };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => { removeEventListener("scroll", schedule); removeEventListener("resize", schedule); if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [category]);

  return <main ref={root} data-ui-theme={mode} data-token-category={category} aria-busy={!Object.keys(measurements.values).length} className="ui-theme token-document sb-unstyled">
    <header className="token-header"><h1>{page.title}</h1><p className="token-lead">{page.description}</p>
      {category === "all" && <p className="token-meta">{tokens.length} 项语义与尺度定义 · {aliases.length} 项 Tailwind 映射 · {textStyles.length} 个语义文字样式 · {utilities.length} 个 utility</p>}
      {category === "colors" && <p className="token-meta">{tokens.filter(token => token.colorGroup && !token.projectExtension).length} 项 Astryx 语义角色 · {tokens.filter(token => token.projectExtension).length} 项项目扩展 · {tokens.filter(token => token.pending).length} 项待配置 · <a href={`/?path=/docs/ui-palette--docs&globals=${globalsParam}`} target="_top">基础色板 Palette</a></p>}
    </header>
    <nav className="token-toc" aria-label="本页内容"><span>On this page</span><ul>{sections.map(section => <li key={section.id}><a href={`#token-${section.id}`} target="_self" aria-current={active === `token-${section.id}` ? "location" : undefined} onClick={() => setActive(`token-${section.id}`)}>{section.title}</a></li>)}</ul></nav>
    <div className="token-body">{sections.map(section => <section key={section.id} id={`token-${section.id}`} aria-labelledby={`token-title-${section.id}`}><h2 id={`token-title-${section.id}`}><a href={`#token-${section.id}`} target="_self">{section.title}</a></h2>{section.description && <p className="token-section-description">{section.description}</p>}
      {section.rows && <TokenTable rows={section.rows} values={measurements.values} mode={mode} showUsage={category !== "all"} title={section.title} />}
      {section.content}
    </section>)}
      <footer className="token-note">{category === "elevation" ? "基础尺度由主题统一维护，组件按语义角色消费。浅深色参数随主题切换；边框、浮层轮廓、键盘焦点与缩放动效分别管理。" : <>语义命名与尺度参考 <a href={`https://github.com/facebook/astryx/tree/${sourceRef}`} target="_blank" rel="noopener noreferrer">Astryx Neutral + Core · {sourceRef.slice(0, 7)}</a>；颜色主要引用 <a href="https://tailwindcss.com/docs/colors" target="_blank" rel="noopener noreferrer">Tailwind 基础色板</a>；阴影使用统一递增尺度，内侧高光、浮层轮廓与组件描边分别维护；视觉配置采用 <a href="https://ui.shadcn.com/create?preset=b5F2gjwQRE" target="_blank" rel="noopener noreferrer">shadcn Luma · b5F2gjwQRE</a>，正文默认使用 Noto Sans，标题默认跟随正文，图标使用 Hugeicons，圆角基准为 8px；当前预览由工具栏选择字体与圆角。brand 待配置；自适应字号与 domain 覆盖尚未接入。</>}</footer>
    </div>
  </main>;
}
