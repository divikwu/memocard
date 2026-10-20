import type { ReactNode } from "react";
import { Source } from "@storybook/addon-docs/blocks";
import { ThemeProvider, convert, themes } from "storybook/theming";

const sourceTheme = convert(themes.light);

export function ButtonCodePanel({ code, children, iframe = false }: { code: string; children: ReactNode; iframe?: boolean }) {
  return <div className={`button-code-panel${iframe ? " button-code-panel-iframe" : ""}`}>
    <div className="button-code-preview">{children}</div>
    <details className="button-code-details">
      <summary>查看代码</summary>
      <ThemeProvider theme={sourceTheme}><Source code={code} language="tsx" format={false} /></ThemeProvider>
    </details>
  </div>;
}
