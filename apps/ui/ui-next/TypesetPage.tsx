import { useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Typeset } from "./components/typeset";
import { Button } from "./components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/card";
import { Input } from "./components/input";
import { Label } from "./components/label";
import { usePreviewMode } from "./preview-mode";
import "./typeset-page.css";

const content = `## 把想法整理成可以阅读的内容

MemoCard 将 Markdown 渲染为语义 HTML。Typeset 负责内容的阅读节奏，颜色、字体和圆角继续读取同一套主题 token。

English and 中文 share the same document. **重要的信息保持清晰**，辅助内容有自己的层级；链接可以通过键盘访问，例如 [Typeset 官方文档](https://ui.shadcn.com/docs/typeset)。

### 列表、引用与代码

- 默认正文使用 Noto Sans，中文回退到 Noto Sans SC。
- 默认标题使用 Noto Serif；代码使用独立的等宽字体角色。
  - 嵌套列表沿用相同节奏。
  - 布局宽度由页面容器决定。

1. 先写下内容。
2. 再建立清晰的结构。

- [x] 保留语义 HTML。
- [ ] 在真实业务页面验收内容。

> 好的排版让长内容更容易理解。
>
> 引用中的段落仍遵循相同的单向间距规则。

行内代码如 \`--font-family-body\` 保留独立的字形；代码块在自己的区域内滚动。

\`\`\`tsx
<Typeset>
  <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
</Typeset>
\`\`\`

### 宽表格与长文本

| 场景 | 正文字体 | 标题字体 | 字号来源 | 颜色来源 | 宽度策略 |
| --- | --- | --- | --- | --- | --- |
| 笔记内容 | Noto Sans + SC | Noto Serif + SC | font-size-base | 当前语义角色 | 页面负责阅读宽度 |
| 嵌入组件 | 组件自身配置 | 组件自身配置 | 组件语义尺寸 | 组件状态角色 | 保留自己的布局 |

长链接与标识符也应保持在阅读区域内：https://example.com/notes/a-long-document-identifier-that-should-wrap-without-expanding-the-page。
`;

function EmbeddedControls({ location }: { location: "inside" | "outside" }) {
  const id = useId();
  return <Card data-typeset-controls={location} className={location === "inside" ? "not-typeset mt-6" : undefined} size="sm">
    <CardHeader><CardTitle>组件保持自己的样式</CardTitle><CardDescription>对照字体、尺寸、圆角与表单交互。</CardDescription></CardHeader>
    <CardContent className="grid gap-3"><Label htmlFor={id}>显示名称</Label><Input id={id} defaultValue="MemoCard" /><Button variant="outline" type="button">示例操作</Button></CardContent>
  </Card>;
}

export function TypesetExample() {
  const [appended, setAppended] = useState(false);
  return <div className="typeset-example">
    <div className="typeset-example-toolbar"><Button variant="outline" size="sm" onClick={() => setAppended(!appended)}>{appended ? "移除追加段落" : "追加一段内容"}</Button><span role="status">{appended ? "已追加一段内容" : "检查追加内容前后的排版稳定性"}</span></div>
    <Typeset data-typeset-example="content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ table: ({ children }) => <div className="typeset-scroll" role="region" aria-label="内容表格，可横向滚动" tabIndex={0}><table>{children}</table></div> }}>{content}</ReactMarkdown>
      <div data-not-typeset className="typeset-optout-note"><p>data-not-typeset：保留这段局部 UI 文字的字号和间距。</p><div className="typeset not-typeset">嵌套容器也保持退出内容排版。</div></div>
      <EmbeddedControls location="inside" />
      <p data-stream-anchor="before-append">追加内容只为新段落增加上方间距，已有段落与组件保留当前位置和状态。</p>
      {appended && <p data-stream-append="true">这是一段后来追加的内容。它继续使用当前主题与阅读节奏。</p>}
    </Typeset>
  </div>;
}

const mappings = [
  ["--typeset-font-body", "--font-family-body"],
  ["--typeset-font-heading", "--font-family-heading"],
  ["--typeset-font-mono", "--font-family-code"],
  ["--typeset-size", "--font-size-base"],
  ["--typeset-leading", "--text-reading-leading"],
  ["--typeset-flow", "--spacing-reading-flow"],
];

export function TypesetPage() {
  const mode = usePreviewMode();
  return <main className="ui-next-theme typeset-page sb-unstyled" data-ui-theme={mode}>
    <header className="typeset-page-header"><h1>Typeset</h1><p>HTML 与 Markdown 的内容排版。字体、颜色、圆角和焦点复用当前 token，阅读行高与段落节奏独立于紧凑 UI 文字。</p><a href="https://ui.shadcn.com/docs/typeset">官方文档与接入说明</a></header>
    <section aria-labelledby="typeset-preview-title"><h2 id="typeset-preview-title" className="typeset-page-section-title">内容预览</h2><TypesetExample /></section>
    <section aria-labelledby="typeset-control-title"><h2 id="typeset-control-title" className="typeset-page-section-title">组件对照</h2><p className="typeset-page-note">下方组件位于阅读区外，与正文中使用 not-typeset 的组件对照。Typeset 同时保护带 data-slot 的组件。</p><div className="typeset-control-reference"><EmbeddedControls location="outside" /></div></section>
    <section aria-labelledby="typeset-mapping-title"><h2 id="typeset-mapping-title" className="typeset-page-section-title">Token 映射</h2><dl className="typeset-token-mapping">{mappings.map(([name, token]) => <div key={name}><dt><code>{name}</code></dt><dd><code>{token}</code></dd></div>)}</dl><p className="typeset-page-note">正文默认 16px；窄于 48rem 时保留官方 1.125 倍阅读字号。标题按正文比例派生，阅读宽度由布局指定；按钮、导航与表单仍使用自己的 type-* 和尺寸角色。</p></section>
    <section aria-labelledby="typeset-usage-title"><h2 id="typeset-usage-title" className="typeset-page-section-title">用法与边界</h2><pre className="typeset-usage"><code>{'import { Typeset } from "@ui-next/components/typeset";\n\n<Typeset>\n  <YourMarkdownRenderer />\n  <Card className="not-typeset">...</Card>\n</Typeset>'}</code></pre><p className="typeset-page-note">typeset-scroll 用于需要横向滚动的表格或宽内容。为滚动区域提供名称和键盘焦点；页面不要整体套入 Typeset。HTML 的解析、清理与安全处理由内容渲染层负责。</p></section>
  </main>;
}
