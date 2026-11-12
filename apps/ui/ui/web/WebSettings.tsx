import { useId, useRef } from "react";
import { isNative } from "../../src/bridge";
import type { AppViewState } from "../../src/App";
import { isBrowserVault, isLocalWeb } from "../../src/client-mode";
import { Button } from "../components/button";
import { CreateButton } from "../business/CreateButton";
import { Card, CardContent } from "../components/card";
import { Switch } from "../components/switch";
import { Label } from "../components/label";
import { usePreviewFontStatus } from "../preview-mode";
import { getPreviewRadius, PREVIEW_RADII } from "../preview-appearance";
import { getPreviewFont, PREVIEW_FONTS } from "../preview-fonts";
import { ChevronDownIcon } from "../icons";
import { Spinner } from "../components/spinner";
import { useWebAppearance, WEB_NEUTRALS, WEB_PALETTES } from "./WebAppearance";
import { WebSettingSelect } from "./WebSettingSelect";
import { WebTypographySettings } from "./WebTypographySettings";
import { useAppearanceCatalog, useWorkspaceAppearance } from "./appearance/AppearanceRuntime";
import "./web-settings.css";

const indexedDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

function formatIndexDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "时间未知" : indexedDate.format(date);
}

export function WebSettings({ state: s }: { state: AppViewState }) {
  const id = useId();
  const appearance = useWebAppearance();
  const workspaceAppearance = useWorkspaceAppearance();
  const catalog = useAppearanceCatalog();
  const themeOptions = Object.entries(catalog.themes).map(([value, theme]) => ({ value, label: theme.label }));
  if (appearance && !Object.hasOwn(catalog.themes, appearance.value.interfaceTheme)) themeOptions.push({ value: appearance.value.interfaceTheme, label: "暂不可用" });
  const fonts = usePreviewFontStatus();
  const bodyFont = useRef<HTMLButtonElement>(null);
  const advanced = useRef<HTMLDetailsElement>(null);
  const field = (name: string) => `${id}-${name}`;
  return <div className="web-settings"><h1 className="web-settings-title text-balance">设置</h1>
    <section aria-labelledby={field("vault-heading")}><h2 id={field("vault-heading")}>笔记库</h2>
      <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content">
        <div className="web-setting-row"><div className="web-setting-description"><p className="font-medium">当前笔记库</p><p className="truncate" data-ui-tooltip={s.status?.vaultName || undefined} data-ui-tooltip-overflow>{s.status?.vaultName || "尚未连接笔记库"}</p></div>{!s.unsupportedBrowser && <Button variant="outline" aria-label={s.status?.connected ? "切换笔记库" : "打开已有笔记库"} disabled={!s.sidebar.canChooseVault || s.working || !!s.editor} onClick={() => s.sidebar.onSelectVault(false)}>{s.status?.connected ? "切换" : "打开"}</Button>}</div>
        {!s.unsupportedBrowser && s.sidebar.canCreateVault && <div className="web-setting-row"><div className="web-setting-description"><p className="font-medium">新建笔记库</p><p>使用空文件夹，现有笔记不受影响。</p></div><CreateButton aria-label="创建新笔记库" disabled={s.working || !!s.editor} onClick={() => s.sidebar.onSelectVault(true)}>创建</CreateButton></div>}
        {s.status?.connected && <details className="web-file-status"><summary>本机文件状态<ChevronDownIcon aria-hidden="true" /></summary><div className="web-file-status-content"><p>{isLocalWeb ? "笔记与图片保存在 MemoCard 已授权的文件夹中。" : isBrowserVault ? "笔记与图片保存在所选文件夹中。" : "笔记保存在所选文件夹中；iCloud Drive 文件夹由系统同步。"}</p><p>仅反映本机读取状态，不代表跨设备同步进度。</p><dl><div><dt>已索引笔记</dt><dd>{s.status.coverage.indexed}</dd></div><div><dt>待读取文件</dt><dd>{s.status.coverage.pending}</dd></div><div><dt>需要处理的文件</dt><dd>{s.status.coverage.issues}</dd></div><div><dt>最近索引时间</dt><dd>{s.status.coverage.indexedAt ? <time dateTime={s.status.coverage.indexedAt}>{formatIndexDate(s.status.coverage.indexedAt)}</time> : "—"}</dd></div></dl></div></details>}
      </CardContent></Card>
    </section>
    {appearance && <section aria-labelledby={field("appearance-heading")}><div className="web-setting-section-heading"><h2 id={field("appearance-heading")}>外观</h2><Button variant="secondary" onClick={appearance.resetAppearance}>恢复默认</Button></div><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">
      {!isNative && !s.nativeChrome && <div><Label htmlFor={field("interface-theme")}>界面主题</Label><WebSettingSelect id={field("interface-theme")} value={appearance.value.interfaceTheme} onValueChange={interfaceTheme => workspaceAppearance ? workspaceAppearance.select(interfaceTheme) : appearance.onChange({ ...appearance.value, interfaceTheme })} options={themeOptions} /></div>}
      <div><Label htmlFor={field("theme")}>{isNative || s.nativeChrome ? "主题" : "颜色模式"}</Label><WebSettingSelect id={field("theme")} value={appearance.value.theme} onValueChange={theme => appearance.onChange({ ...appearance.value, theme })} options={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }, { value: "system", label: "跟随系统" }]} /></div>
      <div><Label htmlFor={field("palette")}>强调色</Label><WebSettingSelect id={field("palette")} value={appearance.value.palette} onValueChange={palette => appearance.onChange({ ...appearance.value, palette })} options={WEB_PALETTES} /></div>
      <details ref={advanced} className="web-file-status web-appearance-advanced"><summary>高级外观<ChevronDownIcon aria-hidden="true" /></summary><div className="web-setting-card-content web-advanced-fields">
      <div><Label htmlFor={field("neutral")}>中性色</Label><WebSettingSelect id={field("neutral")} value={appearance.value.neutralPalette} onValueChange={neutralPalette => appearance.onChange({ ...appearance.value, neutralPalette })} options={WEB_NEUTRALS} /></div>
      <div><Label htmlFor={field("heading")}>标题字体</Label><WebSettingSelect id={field("heading")} value={appearance.value.headingFont} onValueChange={headingFont => appearance.onChange({ ...appearance.value, headingFont })} options={[{ value: "inherit", label: "跟随正文" }, ...(appearance.value.headingFont !== "inherit" && !PREVIEW_FONTS.some(font => font.id === appearance.value.headingFont) ? [{ value: appearance.value.headingFont, label: `${getPreviewFont(appearance.value.headingFont).label}（已有设置）` }] : []), ...PREVIEW_FONTS.map(font => ({ value: font.id, label: font.label }))]} /></div>
      <div><Label htmlFor={field("body")}>正文字体</Label><WebSettingSelect ref={bodyFont} id={field("body")} value={appearance.value.bodyFont} onValueChange={bodyFont => appearance.onChange({ ...appearance.value, bodyFont })} options={[...(!PREVIEW_FONTS.some(font => font.id === appearance.value.bodyFont) ? [{ value: appearance.value.bodyFont, label: `${getPreviewFont(appearance.value.bodyFont).label}（已有设置）` }] : []), ...PREVIEW_FONTS.map(font => ({ value: font.id, label: font.label }))]} /></div>
      <div><Label htmlFor={field("radius")}>圆角</Label><WebSettingSelect id={field("radius")} value={appearance.value.radius} onValueChange={radius => appearance.onChange({ ...appearance.value, radius })} options={[...(!PREVIEW_RADII.some(option => option.value === appearance.value.radius) ? [{ value: appearance.value.radius, label: getPreviewRadius(appearance.value.radius).title }] : []), ...PREVIEW_RADII.map(option => ({ value: option.value, label: option.title }))]} /></div>
      </div></details>
      {fonts.status !== "ready" && <div className="web-font-status" role="status"><p>{fonts.status === "failed" ? "所选字体暂时无法加载，当前使用回退字体。" : "正在加载所选字体，当前使用回退字体。"}</p>{fonts.status === "failed" && <Button variant="outline" size="sm" onClick={() => { fonts.retry(); if (advanced.current) advanced.current.open = true; bodyFont.current?.focus(); }}>重试加载字体</Button>}</div>}
      {workspaceAppearance?.error && <div role="status"><p>界面主题加载失败，当前界面仍可使用。</p><Button variant="outline" size="sm" onClick={workspaceAppearance.retry}>重试加载界面主题</Button></div>}
      {workspaceAppearance?.applied.themeFallback && <p role="status" className="text-sm text-secondary">所选界面主题暂不可用，当前使用兼容外观。</p>}
      {appearance.persistenceError && <p role="status" className="text-sm text-error">无法读取或保存外观设置；本次会话中的选择仍然有效。</p>}
    </CardContent></Card></section>}
    <WebTypographySettings />
    {s.capabilities.has("openWeb") && <section aria-labelledby={field("web-heading")}><h2 id={field("web-heading")}>本机 Web</h2><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content"><div className="web-setting-block"><div className="web-setting-description"><p className="font-medium">浏览器访问</p><p>通过 MemoCard 菜单栏服务，在浏览器中打开统一的多笔记库界面。</p></div><Button disabled={s.working} onClick={() => void s.onOpenLocalWeb()}>在浏览器中打开</Button></div></CardContent></Card></section>}
    {s.environment?.platform === "mac" && s.capabilities.has("setMCPEnabled") && <section aria-labelledby={field("mcp-heading")}><h2 id={field("mcp-heading")}>MCP 本机读写</h2><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content"><div className="web-setting-block"><div className="flex items-start justify-between gap-4"><div className="web-setting-description"><Label htmlFor={field("mcp")}>允许本机工具读写</Label><p>{s.environment.mcpEnabled && !s.environment.mcpWritesEnabled ? "当前仅读取。" : "写入时检查内容版本。"}</p></div><Switch id={field("mcp")} checked={s.environment.mcpWritesEnabled === true} onCheckedChange={() => void s.onToggleMCP()} disabled={!s.status?.connected || s.working} /></div>{s.environment.mcpEnabled && !s.environment.mcpWritesEnabled && <Button variant="outline" disabled={s.working} onClick={() => void s.onToggleMCP(false)}>关闭旧版读取</Button>}<p className="text-sm text-secondary">保持主客户端运行。可新建、修改、移入回收站和恢复笔记，不开放永久删除。</p>{s.working && <p role="status" className="web-settings-working"><Spinner aria-hidden="true" />正在更新连接…</p>}</div></CardContent></Card></section>}
  </div>;
}
