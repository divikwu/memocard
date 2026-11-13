import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Drawer, Loupe, Plug, Query, Rail } from "@lucasmarkes/hairline/react";
import { Card, CardContent } from "../components/card";
import { PreviewModeProvider } from "../preview-mode";
import { PreviewHeader } from "./PreviewHeader";
import { TooltipHints } from "../components/tooltip";
import "../preview-appearance.css";
import "../business/EmptyIllustration.css";
import "./preview.css";

const illustrations = [
  { id: "drawer", label: "空的分类抽屉", Artwork: Drawer },
  { id: "loupe", label: "在空白纸上寻找的放大镜", Artwork: Loupe },
  { id: "plug", label: "尚未连接的插头与插座", Artwork: Plug },
  { id: "query", label: "表示笔记不存在的问号", Artwork: Query },
  { id: "rail", label: "空衣架，悬停时衣架轻轻摆动", Artwork: Rail },
];

function Illustrations() {
  const [theme, setTheme] = useState<"light" | "dark">(() => new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light");
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    const url = new URL(location.href);
    url.searchParams.set("theme", next);
    history.replaceState(null, "", url);
  }

  return <PreviewModeProvider mode={theme}><TooltipHints>
    <div className="ui-theme ui-preview" data-ui-theme={theme}>
      <PreviewHeader theme={theme} onToggleTheme={toggleTheme} back hideTitle />
      <main aria-label="空状态插画" className="ui-preview-content">
        <ul aria-label="空状态插画作品" className="ui-preview-art-grid">
          {illustrations.map(({ id, label, Artwork }) => <li key={id} className="min-w-0">
            <Card size="sm" className="ui-preview-art-card shadow-none">
              <CardContent>
                <Artwork className="ui-hairline ui-hairline-gallery w-full" theme={theme} intensity={0.5} label={label} />
              </CardContent>
            </Card>
          </li>)}
        </ul>
      </main>
    </div>
  </TooltipHints></PreviewModeProvider>;
}

const root = createRoot(document.getElementById("root")!);
root.render(<Illustrations />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
