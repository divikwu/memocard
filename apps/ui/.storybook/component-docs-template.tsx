import { useContext, useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";
import { Code2 } from "lucide-react";
import { AnchorMdx, CodeOrSourceMdx, Description, DocsContext, HeadersMdx, Markdown, Source, Title } from "@storybook/addon-docs/blocks";
import { ThemeProvider, convert, themes } from "storybook/theming";
import { Button } from "../src/components/ui/button";
import { Badge } from "../src/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";

type ComponentDocsTemplateProps = {
  name: string;
  overview: ReactNode;
  properties: ReactNode;
  accessibility: ReactNode;
};

export type ComponentDocsPractice = {
  guidance: "do" | "dont";
  description: string;
};

export function ComponentDocsBestPractices({ items }: { items: readonly ComponentDocsPractice[] }) {
  return <div className="component-docs-table-wrap component-docs-best-practices sb-unstyled">
    <table className="component-docs-table" aria-label="最佳实践">
      <thead><tr><th scope="col">指引</th><th scope="col">实践</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.description}>
        <th scope="row"><Badge variant={item.guidance === "do" ? "secondary" : "outline"}>{item.guidance === "do" ? "推荐" : "避免"}</Badge></th>
        <td><Markdown>{item.description}</Markdown></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

// The caller supplies component-specific content; the template owns page layout.
export function ComponentDocsTemplate({ name, overview, properties, accessibility }: ComponentDocsTemplateProps) {
  return <div className="component-docs">
    <Title>{name}</Title><Description />
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="component-docs-tab-list" aria-label={`${name} 文档`}>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="properties">Properties</TabsTrigger>
        <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
      </TabsList>
      <TabsContent className="component-docs-panel" value="overview">{overview}</TabsContent>
      <TabsContent className="component-docs-panel" value="properties" keepMounted>{properties}</TabsContent>
      <TabsContent className="component-docs-panel" value="accessibility">{accessibility}</TabsContent>
    </Tabs>
  </div>;
}

function useDocsPreview() {
  const context = useContext(DocsContext);
  // Isolated Docs iframes use Storybook's embed mode. Portals in browser tests
  // retain DocsContext instead, as do examples rendered directly on a Docs page.
  return Boolean(context) || new URLSearchParams(window.location.search).get("embed") === "true";
}

export function ComponentDocsStandalone({ children }: { children: ReactNode }) {
  const embedded = useDocsPreview();
  return embedded ? children : <div className="component-docs-standalone">{children}</div>;
}

const sourceTheme = convert(themes.light);

export function ComponentDocsSource({ code }: { code: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copyStatus === "idle") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);
  return <div className="component-docs-source sb-unstyled">
    <div className="component-docs-source-toolbar">
      <span className="component-docs-source-language">TSX</span>
      <Button type="button" variant="ghost" size="sm" className="min-w-20" onClick={() => {
        void navigator.clipboard.writeText(code).then(() => setCopyStatus("copied"), () => setCopyStatus("failed"));
      }}><span aria-live="polite">{copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Copy failed" : "Copy"}</span></Button>
    </div>
    <ThemeProvider theme={sourceTheme}><Source code={code} language="tsx" format={false} copyable={false} /></ThemeProvider>
  </div>;
}

export type ComponentDocsParameter = {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description: ReactNode;
  control?: (props: { id: string; "aria-labelledby": string; "aria-describedby": string }) => ReactNode;
};

function ComponentDocsPreviewHeader({ title, showCode, controls, onToggle }: {
  title: string; showCode: boolean; controls: string; onToggle: () => void;
}) {
  return <div className="component-docs-preview-header">
    <p className="component-docs-preview-title">{title}</p>
    <Button type="button" variant="ghost" size="icon-sm" className="component-docs-preview-code-toggle" aria-label="切换预览与代码" title={showCode ? "返回预览" : "查看代码"} aria-pressed={showCode} aria-controls={controls} onClick={onToggle}><Code2 aria-hidden="true" /></Button>
  </div>;
}

export function ComponentDocsProperties({ name, preview, code, parameters, feedback, onReset, resetLabel = "Reset", children }: {
  name: string;
  preview: ReactNode;
  code: string;
  parameters: ComponentDocsParameter[];
  feedback?: ReactNode;
  onReset: () => void;
  resetLabel?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const [showCode, setShowCode] = useState(false);
  const parameterLabel = parameters.every(parameter => parameter.required) ? "必填参数" : parameters.every(parameter => !parameter.required) ? "可选参数" : "参数";
  return <section className="component-docs-properties sb-unstyled" aria-label={`${name} 参数演示`}>
    <div className="component-docs-properties-preview">
      <ComponentDocsPreviewHeader title={name} showCode={showCode} controls={`${id}-code`} onToggle={() => setShowCode(!showCode)} />
      <div className="component-docs-properties-stage" hidden={showCode}>{preview}</div>
      <div className="component-docs-properties-code" id={`${id}-code`} role="region" aria-label={`${name} 代码`} hidden={!showCode}><ComponentDocsSource code={code} /></div>
    </div>
    <div className="component-docs-properties-summary">
      {feedback !== undefined && <output className="component-docs-properties-feedback" aria-live="polite">{feedback}</output>}
      <Button type="button" variant="outline" size="sm" onClick={onReset}>{resetLabel}</Button>
    </div>
    {children}
    <p className="component-docs-properties-caption" aria-hidden="true">Props</p>
    <div className="component-docs-properties-table-wrap" role="region" aria-label={`${name} 参数表`} tabIndex={0}><table className="component-docs-properties-table" aria-label={`${name} API`}>
      <caption className="sr-only">Props</caption>
      <thead><tr><th scope="col">{parameterLabel}</th><th scope="col">类型 / 说明</th><th scope="col">值</th></tr></thead>
      <tbody>{parameters.map(parameter => {
        const controlId = `${id}-${parameter.name}`;
        const control = parameter.control?.({ id: controlId, "aria-labelledby": `${controlId}-label`, "aria-describedby": `${controlId}-description` });
        return <tr key={parameter.name}>
          <th scope="row">{control == null ? <code>{parameter.name}</code> : <label id={`${controlId}-label`} htmlFor={controlId}><code>{parameter.name}</code></label>}</th>
          <td id={`${controlId}-description`}><code>{parameter.type}</code>{parameter.defaultValue !== undefined && <small>默认：{parameter.defaultValue}</small>}{parameter.description}</td>
          <td>{control ?? <span className="component-docs-properties-readonly">—</span>}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}

export function ComponentDocsExample({ title, story, code, description, children, iframe = false }: {
  title: string; story: string; code: string; description: ReactNode; children: ReactNode; iframe?: boolean;
}) {
  const embedded = useDocsPreview();
  const id = useId();
  const [showCode, setShowCode] = useState(false);
  return <section aria-label={title} className={`component-docs-example sb-unstyled${iframe ? " component-docs-example-iframe" : ""}`}>
    <ComponentDocsPreviewHeader title={title} showCode={showCode} controls={`${id}-code`} onToggle={() => setShowCode(!showCode)} />
    <div className="component-docs-example-preview">{children}</div>
    <Tabs value={showCode ? "code" : "description"} onValueChange={value => setShowCode(value === "code")} className="component-docs-example-details">
      <div className="component-docs-example-toolbar">
        <TabsList variant="line" className="component-docs-example-tabs" aria-label="示例详情">
          <TabsTrigger value="description">描述</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        {embedded && <Button variant="ghost" size="sm" render={<a href={`./?path=/story/${story}`} target="_top" />}>在 Canvas 中打开</Button>}
      </div>
      <TabsContent value="description" className="component-docs-example-content"><div className="component-docs-example-description">{description}</div></TabsContent>
      <TabsContent id={`${id}-code`} value="code" className="component-docs-example-content" keepMounted><ComponentDocsSource code={code} /></TabsContent>
    </Tabs>
  </section>;
}

function DocsTable(props: ComponentProps<"table">) {
  return <div className="component-docs-table-scroll" role="region" aria-label="文档参考表" tabIndex={0}><table {...props} /></div>;
}

// Storybook's Markdown options replace its default overrides; preserve them.
const markdownOptions = { overrides: { a: AnchorMdx, code: CodeOrSourceMdx, ...HeadersMdx, table: { component: DocsTable } } };

export function ComponentDocsMarkdown({ children }: { children: string }) {
  return <div className="component-docs-markdown"><Markdown options={markdownOptions}>{children}</Markdown></div>;
}
