import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Mascot } from "page-mascot";
import { mascots } from "../../mascot-fixtures/catalog";
import mascotLicense from "../../mascot-fixtures/LICENSE.txt?url";
import { Badge } from "../components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/card";
import { TooltipHints } from "../components/tooltip";
import { PreviewModeProvider } from "../preview-mode";
import { PreviewHeader } from "./PreviewHeader";
import "./preview.css";
import "../preview-appearance.css";
import "./mascot-preview.css";

function Mascots() {
  const [theme, setTheme] = useState<"light" | "dark">(() => new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light");
  const changeTheme = (next: string | null) => {
    if (next !== "light" && next !== "dark") return;
    setTheme(next);
    const url = new URL(location.href);
    url.searchParams.set("theme", next);
    history.replaceState(null, "", url);
  };

  return <PreviewModeProvider mode={theme}><TooltipHints>
    <div className="ui-theme ui-preview" data-ui-theme={theme}>
      <PreviewHeader theme={theme} onToggleTheme={() => changeTheme(theme === "light" ? "dark" : "light")} back />
      <main className="ui-preview-content mascot-preview-content">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-balance font-heading text-2xl font-medium">吉祥物</h1><Badge variant="secondary" className="tabular-nums">{mascots.length} 个角色</Badge></div>
          <p className="text-pretty text-sm text-secondary">移动鼠标，让角色跟着你转头；点击角色，看看它们的反应。</p>
          <p className="text-pretty text-xs text-secondary">点击会眨眼，出现爱心、闪光或开心表情，快速连点会转圈眼。也可以用 Tab 聚焦角色，按 Enter 或空格互动。</p>
        </div>
        <ul aria-label="吉祥物角色" className="ui-preview-art-grid">
          {mascots.map(mascot => <li key={mascot.name} className="min-w-0">
            <Card size="sm" className="ui-preview-art-card gap-2 text-center shadow-none">
              <CardContent>
                <div className="relative isolate" data-mascot-fade={mascot.fade || undefined}>
                  <Mascot directions={mascot.directions} reactions={mascot.reactions} size={140} label={mascot.name} className="rounded-element outline-none focus-visible:focus-ring" />
                  {mascot.fade && <span aria-hidden="true" className="mascot-preview-fade pointer-events-none absolute inset-0" />}
                </div>
              </CardContent>
              <CardHeader className="gap-1.5"><CardTitle><h2 className="text-balance text-sm font-medium">{mascot.name}</h2></CardTitle><CardDescription className="text-pretty text-xs">{mascot.description}</CardDescription></CardHeader>
            </Card>
          </li>)}
        </ul>
        <p className="text-pretty text-xs text-secondary">交互与预设角色来自 <a href="https://koboyo.com/page-mascot" target="_blank" rel="noreferrer" className="underline underline-offset-4 focus-visible:focus-ring">page-mascot</a> · <a href={mascotLicense} className="underline underline-offset-4 focus-visible:focus-ring">MIT License</a></p>
      </main>
    </div>
  </TooltipHints></PreviewModeProvider>;
}

const root = createRoot(document.getElementById("root")!);
root.render(<Mascots />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
