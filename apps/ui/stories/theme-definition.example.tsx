import { useState, type CSSProperties } from "react";
import { defineTheme, type DefineThemeInput } from "../src/features/theme/define-theme";
import { ThemeStyle } from "../src/features/theme/ThemeStyle";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Card, CardContent } from "../src/components/ui/card";
import { Badge } from "../src/components/ui/badge";
import baseInput from "../../../design/themes/ocean-base.json";
import childInput from "../../../design/themes/ocean.json";
import builtCSS from "../../../design/themes/ocean.generated.css?raw";

export const oceanTheme = defineTheme({ ...childInput as unknown as DefineThemeInput, extends: defineTheme(baseInput as unknown as DefineThemeInput) });
export { builtCSS };
export const builtOceanTheme = { name: "ocean" };

export function ThemeDefinitionSample() {
  return <div className="space-y-4 bg-body p-6 text-primary" data-testid="themed-body">
    <Card data-testid="themed-card"><CardContent className="space-y-4 p-6">
      <p className="type-body" data-testid="themed-text">主题继承、浅深模式与语义颜色。</p>
      <code className="font-mono" data-testid="themed-code">const theme = defineTheme(options);</code>
      <p data-testid="brand-text" style={{ color: "var(--brand-emphasis)" }}>继承的主题局部值</p>
      <div className="flex flex-wrap gap-3 bg-card">
        <Button data-testid="themed-action">主要操作</Button>
        <Button variant="link" data-testid="themed-link">强调文字</Button>
        <Button style={{ "--primary": "#123456", "--primary-foreground": "white" } as CSSProperties} data-testid="local-action">局部覆盖</Button>
        <Badge variant="success">成功</Badge>
      </div>
      <Input aria-label="主题输入框" placeholder="输入内容" />
    </CardContent></Card>
  </div>;
}

export function ThemeDefinitionExample() {
  const [distribution, setDistribution] = useState<"runtime" | "built" | "default">("runtime");
  return <>
    {distribution === "built" && <style>{builtCSS}</style>}
    <ThemeStyle definition={distribution === "runtime" ? oceanTheme : distribution === "built" ? builtOceanTheme : undefined} />
    <div className="flex flex-wrap gap-2 bg-body p-4 text-primary">
      <Button variant="outline" onClick={() => setDistribution("runtime")}>运行时定义</Button>
      <Button variant="outline" onClick={() => setDistribution("built")}>预编译 CSS</Button>
      <Button variant="outline" onClick={() => setDistribution("default")}>原有主题</Button>
    </div>
    <ThemeDefinitionSample />
  </>;
}
