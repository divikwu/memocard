import { useEffect, useId, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import SourceCodeIcon from "@hugeicons/core-free-icons/SourceCodeIcon";
import { Button, buttonVariants } from "./components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/tabs";
import { usePreviewGlobalsParam, usePreviewMode } from "./preview-mode";
import "./component-docs.css";

export function ComponentDocsSource({ code }: { code: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);
  return <div className="next-docs-source">
    <div className="next-docs-source-toolbar"><span>TSX</span><Button type="button" variant="ghost" size="sm" onClick={() => {
      void navigator.clipboard.writeText(code).then(() => setStatus("copied"), () => setStatus("failed"));
    }}><span aria-live="polite">{status === "copied" ? "已复制" : status === "failed" ? "复制失败" : "复制代码"}</span></Button></div>
    <pre tabIndex={0} aria-label="组件用法代码"><code>{code}</code></pre>
  </div>;
}

export function ComponentDocsExample({ title, code, story, description, children }: { title: string; code: string; story: string; description: string; children: ReactNode }) {
  const id = useId();
  const globalsParam = usePreviewGlobalsParam();
  const [detail, setDetail] = useState("description");
  return <section className="next-docs-example" aria-label={title} data-docs-example="usage">
    <header className="next-docs-example-header"><h3>{title}</h3><Button type="button" variant="ghost" size="icon-sm" aria-label="切换预览说明与代码" aria-pressed={detail === "code"} aria-controls={`${id}-code`} onClick={() => setDetail(detail === "code" ? "description" : "code")}><HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} aria-hidden="true" /></Button></header>
    <div className="next-docs-example-preview">{children}</div>
    <Tabs className="next-docs-example-details" value={detail} onValueChange={setDetail}>
      <div className="next-docs-example-toolbar"><TabsList variant="line" aria-label={`${title} 示例详情`}><TabsTrigger value="description">描述</TabsTrigger><TabsTrigger value="code">Code</TabsTrigger></TabsList><a className={buttonVariants({ variant: "ghost", size: "sm" })} href={`/?path=/story/${story}&globals=${globalsParam}`} target="_top">在 Canvas 中打开</a></div>
      <TabsContent value="description" className="next-docs-example-content"><p>{description}</p></TabsContent>
      <TabsContent value="code" className="next-docs-example-content" keepMounted><div id={`${id}-code`}><ComponentDocsSource code={code} /></div></TabsContent>
    </Tabs>
  </section>;
}

export function ComponentDocsBestPractices({ items }: { items: { guidance: "do" | "dont"; description: ReactNode }[] }) {
  return <div className="next-docs-table-wrap" role="region" aria-label="最佳实践" tabIndex={0}><table className="next-docs-table"><thead><tr><th scope="col">指引</th><th scope="col">实践</th></tr></thead><tbody>{items.map((item, index) => <tr key={index}><th scope="row"><span className="next-docs-practice" data-guidance={item.guidance}>{item.guidance === "do" ? "推荐" : "避免"}</span></th><td>{item.description}</td></tr>)}</tbody></table></div>;
}

type ComponentDocsTemplateProps = {
  name: string;
  description?: string;
  hero?: ReactNode;
  overview: ReactNode;
  properties: ReactNode;
  accessibility: ReactNode;
  component?: string;
};

export function ComponentDocsTemplate({ name, description, hero, overview, properties, accessibility, component }: ComponentDocsTemplateProps) {
  const mode = usePreviewMode();
  return <main className="ui-next-theme component-docs-next sb-unstyled" data-ui-theme={mode} data-component-docs={component}>
    <header className="next-docs-header"><h1>{name}</h1>{description && <p>{description}</p>}</header>
    <Tabs defaultValue="overview" className="next-docs-tabs">
      <div className="next-docs-nav-wrap" onFocusCapture={event => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}><TabsList variant="line" className="next-docs-nav" aria-label={`${name} 文档`}><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="properties">Properties</TabsTrigger><TabsTrigger value="accessibility">Accessibility</TabsTrigger></TabsList></div>
      <TabsContent value="overview" className="next-docs-panel">
        {hero && <div className="next-docs-hero" role="group" aria-label={`${name} 主要预览`} data-docs-example="hero"><div>{hero}</div></div>}
        {overview}
      </TabsContent>
      <TabsContent value="properties" className="next-docs-panel" keepMounted>{properties}</TabsContent>
      <TabsContent value="accessibility" className="next-docs-panel">{accessibility}</TabsContent>
    </Tabs>
    <footer className="next-docs-footer">shadcn Luma · Base UI · Astryx 语义 token · Tailwind 基础色板 · 默认 8px 圆角基准</footer>
  </main>;
}
