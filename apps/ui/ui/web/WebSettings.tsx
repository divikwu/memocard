import { useId, useRef } from "react";
import { isNative } from "../../src/bridge";
import type { AppViewState } from "../../src/App";
import { Button } from "../components/button";
import { Card, CardContent } from "../components/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Switch } from "../components/switch";
import { Label } from "../components/label";
import { usePreviewFontStatus } from "../preview-mode";
import { getPreviewRadius, PREVIEW_RADII } from "../preview-appearance";
import { getPreviewFont, PREVIEW_FONTS } from "../preview-fonts";
import { ChevronDownIcon } from "../icons";
import { Spinner } from "../components/spinner";
import { useWebAppearance, WEB_NEUTRALS, WEB_PALETTES } from "./WebAppearance";
import { WebSettingSelect } from "./WebSettingSelect";
import { WebSettingsDisclosure } from "./WebSettingsDisclosure";
import { WebTypographySettings } from "./WebTypographySettings";
import { ReopenLocalWeb } from "./ReopenLocalWeb";
import { useAppearanceCatalog, useWorkspaceAppearance } from "./appearance/AppearanceRuntime";
import "./web-settings-layout.css";
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
  const showVaultMenu = !s.nativeChrome && !isNative && !s.unsupportedBrowser;
  const vaultAction = s.status?.connected ? "切换" : "打开";
  const vaultActionLabel = s.status?.connected ? "切换笔记库" : "打开已有笔记库";
  const vaultActionsDisabled = s.working || !!s.editor;
  const chooseVaultDisabled = !s.sidebar.canChooseVault || vaultActionsDisabled;
  return <div className="web-settings"><header className="web-collection-heading"><h1 className="web-settings-title text-balance">设置</h1></header><div className="web-settings-panel">
    <section aria-labelledby={field("vault-heading")}><h2 id={field("vault-heading")}>笔记库</h2>
      <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content">
        {s.localWebReconnectRequired ? <div className="web-setting-row">
          <p className="web-setting-description font-medium" role="status">需要重新连接本机服务</p>
          <div className="web-setting-vault-actions"><ReopenLocalWeb inline /></div>
        </div> : <>
        <div className={showVaultMenu ? "web-setting-row web-setting-list-row" : "web-setting-row"}>
          <div className="web-setting-description web-setting-list-label"><p className="truncate font-medium" data-ui-tooltip={s.status?.vaultName || undefined} data-ui-tooltip-overflow>{s.status?.vaultName || "尚未连接笔记库"}</p></div>
          {!s.unsupportedBrowser && (showVaultMenu ? <DropdownMenu>
            <DropdownMenuTrigger className="web-setting-list-trigger focus-visible:focus-ring disabled:opacity-50" aria-label={`笔记库操作（${vaultAction}）`} disabled={vaultActionsDisabled || (!s.sidebar.canChooseVault && !s.sidebar.canCreateVault)}>
              <span className="web-setting-list-value">{vaultAction}</span><ChevronDownIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label="笔记库操作">
              <DropdownMenuItem disabled={chooseVaultDisabled} onClick={() => s.sidebar.onSelectVault(false)}>{vaultActionLabel}</DropdownMenuItem>
              {s.sidebar.canCreateVault && <DropdownMenuItem disabled={vaultActionsDisabled} onClick={() => s.sidebar.onSelectVault(true)}>新建笔记库</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu> : <div className="web-setting-vault-actions">
            <Button variant="outline" aria-label={vaultActionLabel} disabled={chooseVaultDisabled} onClick={() => s.sidebar.onSelectVault(false)}>{vaultAction}</Button>
            {s.sidebar.canCreateVault && <Button type="button" variant="outline" className="bg-surface text-primary dark:bg-surface" aria-label="新建笔记库" data-ui-tooltip="选择空文件夹创建笔记库" disabled={vaultActionsDisabled} onClick={() => s.sidebar.onSelectVault(true)}>新建</Button>}
          </div>)}
        </div>
        {s.status?.connected && <WebSettingsDisclosure label="本机文件状态"><div className="web-file-status-content"><dl><div><dt>已索引笔记</dt><dd>{s.status.coverage.indexed}</dd></div><div><dt>待读取文件</dt><dd>{s.status.coverage.pending}</dd></div><div><dt>需要处理的文件</dt><dd>{s.status.coverage.issues}</dd></div><div><dt>最近索引时间</dt><dd>{s.status.coverage.indexedAt ? <time dateTime={s.status.coverage.indexedAt}>{formatIndexDate(s.status.coverage.indexedAt)}</time> : "—"}</dd></div></dl></div></WebSettingsDisclosure>}
        </>}
      </CardContent></Card>
    </section>
    {appearance && <section aria-labelledby={field("appearance-heading")}><div className="web-setting-section-heading"><h2 id={field("appearance-heading")}>外观</h2><Button variant="ghost" className="text-secondary" onClick={appearance.resetAppearance}>恢复默认</Button></div><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">
      {!isNative && !s.nativeChrome && <WebSettingSelect id={field("interface-theme")} label="界面主题" value={appearance.value.interfaceTheme} onValueChange={interfaceTheme => workspaceAppearance ? workspaceAppearance.select(interfaceTheme) : appearance.onChange({ ...appearance.value, interfaceTheme })} options={themeOptions} />}
      <WebSettingSelect id={field("theme")} label={isNative || s.nativeChrome ? "主题" : "颜色模式"} value={appearance.value.theme} onValueChange={theme => appearance.onChange({ ...appearance.value, theme })} options={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }, { value: "system", label: "跟随系统" }]} />
      <WebSettingSelect id={field("palette")} label="强调色" value={appearance.value.palette} onValueChange={palette => appearance.onChange({ ...appearance.value, palette })} options={WEB_PALETTES} />
      <WebSettingsDisclosure ref={advanced} label="高级外观" advanced><div className="web-setting-card-content web-advanced-fields">
      <WebSettingSelect id={field("neutral")} label="中性色" value={appearance.value.neutralPalette} onValueChange={neutralPalette => appearance.onChange({ ...appearance.value, neutralPalette })} options={WEB_NEUTRALS} />
      <WebSettingSelect id={field("heading")} label="标题字体" value={appearance.value.headingFont} onValueChange={headingFont => appearance.onChange({ ...appearance.value, headingFont })} options={[{ value: "inherit", label: "跟随正文" }, ...(appearance.value.headingFont !== "inherit" && !PREVIEW_FONTS.some(font => font.id === appearance.value.headingFont) ? [{ value: appearance.value.headingFont, label: `${getPreviewFont(appearance.value.headingFont).label}（已有设置）` }] : []), ...PREVIEW_FONTS.map(font => ({ value: font.id, label: font.label }))]} />
      <WebSettingSelect ref={bodyFont} id={field("body")} label="正文字体" value={appearance.value.bodyFont} onValueChange={bodyFont => appearance.onChange({ ...appearance.value, bodyFont })} options={[...(!PREVIEW_FONTS.some(font => font.id === appearance.value.bodyFont) ? [{ value: appearance.value.bodyFont, label: `${getPreviewFont(appearance.value.bodyFont).label}（已有设置）` }] : []), ...PREVIEW_FONTS.map(font => ({ value: font.id, label: font.label }))]} />
      <WebSettingSelect id={field("radius")} label="圆角" value={appearance.value.radius} onValueChange={radius => appearance.onChange({ ...appearance.value, radius })} options={[...(!PREVIEW_RADII.some(option => option.value === appearance.value.radius) ? [{ value: appearance.value.radius, label: getPreviewRadius(appearance.value.radius).title }] : []), ...PREVIEW_RADII.map(option => ({ value: option.value, label: option.title }))]} />
      </div></WebSettingsDisclosure>
      {fonts.status !== "ready" && <div className="web-font-status" role="status"><p>{fonts.status === "failed" ? "所选字体暂时无法加载，当前使用回退字体。" : "正在加载所选字体，当前使用回退字体。"}</p>{fonts.status === "failed" && <Button variant="outline" size="sm" onClick={() => {
        fonts.retry();
        const details = advanced.current;
        if (details && !details.open) {
          details.addEventListener("toggle", () => bodyFont.current?.focus(), { once: true });
          details.open = true;
        } else bodyFont.current?.focus();
      }}>重试加载字体</Button>}</div>}
      {workspaceAppearance?.error && <div role="status"><p>界面主题加载失败，当前界面仍可使用。</p><Button variant="outline" size="sm" onClick={workspaceAppearance.retry}>重试加载界面主题</Button></div>}
      {workspaceAppearance?.applied.themeFallback && <p role="status" className="text-sm text-secondary">所选界面主题暂不可用，当前使用兼容外观。</p>}
      {appearance.persistenceError && <p role="status" className="text-sm text-error">无法读取或保存外观设置；本次会话中的选择仍然有效。</p>}
    </CardContent></Card></section>}
    <WebTypographySettings />
    {s.capabilities.has("openWeb") && <section aria-labelledby={field("web-heading")}><h2 id={field("web-heading")}>本机 Web</h2><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content"><div className="web-setting-block"><div className="web-setting-description"><p className="font-medium">浏览器访问</p><p>通过 MemoCard 菜单栏服务，在浏览器中打开统一的多笔记库界面。</p></div><Button disabled={s.working} onClick={() => void s.onOpenLocalWeb()}>在浏览器中打开</Button></div></CardContent></Card></section>}
    {s.environment?.platform === "mac" && s.capabilities.has("setMCPEnabled") && <section aria-labelledby={field("mcp-heading")}><h2 id={field("mcp-heading")}>MCP 本机读写</h2><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content"><div className="web-setting-block"><div className="flex items-start justify-between gap-4"><div className="web-setting-description"><Label htmlFor={field("mcp")}>允许本机工具读写</Label><p>{s.environment.mcpEnabled && !s.environment.mcpWritesEnabled ? "当前仅读取。" : "写入时检查内容版本。"}</p></div><Switch id={field("mcp")} checked={s.environment.mcpWritesEnabled === true} onCheckedChange={() => void s.onToggleMCP()} disabled={!s.status?.connected || s.working} /></div>{s.environment.mcpEnabled && !s.environment.mcpWritesEnabled && <Button variant="outline" disabled={s.working} onClick={() => void s.onToggleMCP(false)}>关闭旧版读取</Button>}<p className="text-sm text-secondary">保持主客户端运行。可新建、修改、移入回收站和恢复笔记，不开放永久删除。</p>{s.working && <p role="status" className="web-settings-working"><Spinner aria-hidden="true" />正在更新连接…</p>}</div></CardContent></Card></section>}
  </div></div>;
}
