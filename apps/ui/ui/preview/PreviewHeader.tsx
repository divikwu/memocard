import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import Moon02Icon from "@hugeicons/core-free-icons/Moon02Icon";
import Sun03Icon from "@hugeicons/core-free-icons/Sun03Icon";
import { Button } from "../components/button";

export function PreviewHeader({ theme, onToggleTheme, back = false, title, hideTitle = false }: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  back?: boolean;
  title?: string;
  hideTitle?: boolean;
}) {
  const themeLabel = theme === "light" ? "切换深色主题" : "切换浅色主题";
  return <header className="ui-preview-header">
    <div className="ui-preview-brand">
      {back ? <Button role="link" nativeButton={false} variant="ghost" size="icon" render={<a href={`/?theme=${theme}`} />} aria-label="返回验收首页" data-ui-tooltip="返回验收首页"><HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" /></Button> : <img src="/favicon.png" alt="" className="size-7 shrink-0 object-contain" />}
      {!hideTitle && (title ? <h1 id="ui-preview-title" className="truncate text-base font-medium">{title}</h1> : <span className="text-base font-medium">MemoCard UI</span>)}
    </div>
    <Button variant="ghost" size="icon" aria-label={themeLabel} data-ui-tooltip={themeLabel} onClick={onToggleTheme}><HugeiconsIcon icon={theme === "light" ? Moon02Icon : Sun03Icon} strokeWidth={2} aria-hidden="true" /></Button>
  </header>;
}
