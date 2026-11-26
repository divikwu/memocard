import { Suspense, useId, useRef, useState, type ReactNode, type Ref } from "react";
import ComputerIcon from "@hugeicons/core-free-icons/ComputerIcon";
import Moon02Icon from "@hugeicons/core-free-icons/Moon02Icon";
import Sun03Icon from "@hugeicons/core-free-icons/Sun03Icon";
import { HugeiconsIcon } from "@hugeicons/react";
import { isNative } from "../../src/bridge";
import type { AppViewState } from "../../src/App";
import { Button } from "../components/button";
import { Card, CardContent } from "../components/card";
import { ToggleGroup, ToggleGroupItem } from "../components/toggle-group";
import { Switch } from "../components/switch";
import { Label } from "../components/label";
import { usePreviewFontStatus } from "../preview-mode";
import { getPreviewRadius, PREVIEW_RADII } from "../preview-appearance";
import { getPreviewFont } from "../preview-fonts";
import { ChevronDownIcon } from "../icons";
import { Spinner } from "../components/spinner";
import { useWebAppearance, WEB_NEUTRALS, WEB_PALETTES } from "./WebAppearance";
import { WebSettingSelect } from "./WebSettingSelect";
import { WebSettingsDisclosure } from "./WebSettingsDisclosure";
import { WebTypographySettings } from "./WebTypographySettings";
import { workspaceNavigation } from "./WorkspaceNavigation";
import { recoverableLazy } from "../components/recoverable-lazy";
import { loadWebMoreDrawer } from "./loadWebMoreDrawer";
import { ReopenLocalWeb } from "./ReopenLocalWeb";
import { useAppearanceCatalog, useWorkspaceAppearance } from "./appearance/AppearanceRuntime";
import { fontPreset, noteFontChoices } from "./note-appearance";
import { defaults as defaultTypography } from "../../src/features/typography/preferences";
import { useTypography } from "../../src/features/typography/TypographyProvider";
import "./web-settings-layout.css";
import "./web-settings.css";

const WebMoreDrawer = recoverableLazy(loadWebMoreDrawer, "切换笔记库");

const indexedDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

function formatIndexDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "时间未知" : indexedDate.format(date);
}

const colorModeChoices = [
  { value: "light", label: "浅色", icon: Sun03Icon },
  { value: "dark", label: "深色", icon: Moon02Icon },
  { value: "system", label: "跟随系统", icon: ComputerIcon },
] as const;

const modeOptions = colorModeChoices.map(({ value, label, icon }) => ({
  value, label, preview: <HugeiconsIcon icon={icon} className="size-6" strokeWidth={1.75} aria-hidden="true" />,
}));

const fontOptions = noteFontChoices.map(({ value, label }) => ({
  value, label, preview: <span aria-hidden="true" className="text-2xl leading-none" style={{ fontFamily: getPreviewFont(value).fontFamily }}>Ag</span>,
}));

function SettingsChoices<T extends string>({ label, options, selected, onChange, selectedRef }: {
  label: string; options: readonly { value: T; label: string; preview: ReactNode }[]; selected: T;
  onChange: (value: T) => void; selectedRef?: Ref<HTMLButtonElement>;
}) {
  const labelId = useId();
  return <section className="web-setting-choice-group">
    <p id={labelId} className="text-sm leading-(--text-body-leading) font-medium">{label}</p>
    <ToggleGroup aria-labelledby={labelId} spacing={0.5} className="web-setting-choice-track relative isolate grid w-full grid-cols-3 rounded-element" value={[selected]} onValueChange={([next]) => {
      const choice = options.find(choice => choice.value === next);
      if (choice) onChange(choice.value);
    }}>
      {options.map(choice => <ToggleGroupItem key={choice.value} value={choice.value}
        ref={selected === choice.value ? selectedRef : undefined}
        className="web-setting-choice h-auto min-w-0 flex-col gap-1 px-1 py-2 hover:bg-overlay-hover aria-pressed:bg-transparent">
        {choice.preview}
        <span className="text-xs">{choice.label}</span>
      </ToggleGroupItem>)}
    </ToggleGroup>
  </section>;
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
  const typography = useTypography();
  const field = (name: string) => `${id}-${name}`;
  const showVaultDrawer = !s.nativeChrome && !isNative && !s.unsupportedBrowser;
  const [vaultPanelOpen, setVaultPanelOpen] = useState<boolean | null>(null);
  const vaultTrigger = useRef<HTMLButtonElement>(null);
  const vaultAction = s.status?.connected ? "切换" : "打开";
  const vaultActionLabel = s.status?.connected ? "切换笔记库" : "打开已有笔记库";
  const vaultActionsDisabled = s.working || !!s.editor;
  const chooseVaultDisabled = !s.sidebar.canChooseVault || vaultActionsDisabled;
  return <div className="web-settings"><header className="web-collection-heading"><h1 className="web-settings-title text-balance">设置</h1></header><div className="web-settings-panel">
    <section aria-labelledby={field("vault-heading")}><h2 id={field("vault-heading")} className="web-setting-vault-heading">笔记库</h2>
      <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content">
        {s.localWebReconnectRequired ? <div className="web-setting-row">
          <p className="web-setting-description font-medium" role="status">需要重新连接本机服务</p>
          <div className="web-setting-vault-actions"><ReopenLocalWeb inline /></div>
        </div> : <>
        <div className={showVaultDrawer ? "web-setting-row web-setting-list-row" : "web-setting-row"}>
          <div className="web-setting-description web-setting-list-label"><p className="truncate font-medium" data-ui-tooltip={s.status?.vaultName || undefined} data-ui-tooltip-overflow>{s.status?.vaultName || "尚未连接笔记库"}</p></div>
          {!s.unsupportedBrowser && (showVaultDrawer ? <button type="button" ref={vaultTrigger} aria-haspopup="dialog" aria-expanded={Boolean(vaultPanelOpen)}
            disabled={vaultActionsDisabled} onClick={() => setVaultPanelOpen(true)} aria-label={`笔记库操作（${vaultAction}）`} className="web-setting-list-trigger focus-visible:focus-ring disabled:opacity-50">
            <span className="web-setting-list-value">{vaultAction}</span><ChevronDownIcon aria-hidden="true" />
          </button> : <div className="web-setting-vault-actions">
            <Button variant="outline" aria-label={vaultActionLabel} disabled={chooseVaultDisabled} onClick={() => s.sidebar.onSelectVault(false)}>{vaultAction}</Button>
            {s.sidebar.canCreateVault && <Button type="button" variant="outline" className="bg-surface text-primary dark:bg-surface" aria-label="新建笔记库" data-ui-tooltip="选择空文件夹创建笔记库" disabled={vaultActionsDisabled} onClick={() => s.sidebar.onSelectVault(true)}>新建</Button>}
          </div>)}
        </div>
        {s.status?.connected && <WebSettingsDisclosure label="本机文件状态"><div className="web-file-status-content"><dl><div><dt>已索引笔记</dt><dd>{s.status.coverage.indexed}</dd></div><div><dt>待读取文件</dt><dd>{s.status.coverage.pending}</dd></div><div><dt>需要处理的文件</dt><dd>{s.status.coverage.issues}</dd></div><div><dt>最近索引时间</dt><dd>{s.status.coverage.indexedAt ? <time dateTime={s.status.coverage.indexedAt}>{formatIndexDate(s.status.coverage.indexedAt)}</time> : "—"}</dd></div></dl></div></WebSettingsDisclosure>}
        </>}
      </CardContent></Card>
    </section>
    {appearance && <section aria-labelledby={field("appearance-heading")}><div className="web-setting-section-heading"><h2 id={field("appearance-heading")}>外观</h2><Button variant="ghost" className="text-secondary" onClick={() => {
      appearance.resetAppearance();
      if (typography.value.size !== defaultTypography.size) typography.save({ ...typography.value, size: defaultTypography.size });
    }}>恢复默认</Button></div><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">
      {!isNative && !s.nativeChrome && <WebSettingSelect id={field("interface-theme")} label="界面主题" value={appearance.value.interfaceTheme} onValueChange={interfaceTheme => workspaceAppearance ? workspaceAppearance.select(interfaceTheme) : appearance.onChange({ ...appearance.value, interfaceTheme })} options={themeOptions} />}
      {isNative || s.nativeChrome
        ? <WebSettingSelect id={field("theme")} label="主题" value={appearance.value.theme} onValueChange={theme => appearance.onChange({ ...appearance.value, theme })} options={modeOptions} />
        : <SettingsChoices label="颜色模式" options={modeOptions} selected={appearance.value.theme} onChange={theme => appearance.onChange({ ...appearance.value, theme })} />}
      <SettingsChoices label="标题字体" options={fontOptions} selected={fontPreset(appearance.value.headingFont === "inherit" ? appearance.value.bodyFont : appearance.value.headingFont)}
        onChange={headingFont => appearance.onChange({ ...appearance.value, headingFont })} />
      <SettingsChoices label="正文字体" options={fontOptions} selected={fontPreset(appearance.value.bodyFont)} selectedRef={bodyFont}
        onChange={bodyFont => appearance.onChange({ ...appearance.value, headingFont: appearance.value.headingFont === "inherit" ? appearance.value.bodyFont : appearance.value.headingFont, bodyFont })} />
      <WebSettingSelect id={field("palette")} label="强调色" value={appearance.value.palette} onValueChange={palette => appearance.onChange({ ...appearance.value, palette })} options={WEB_PALETTES} />
      <WebSettingSelect id={field("neutral")} label="中性色" value={appearance.value.neutralPalette} onValueChange={neutralPalette => appearance.onChange({ ...appearance.value, neutralPalette })} options={WEB_NEUTRALS} />
      <div className="web-setting-row"><Label htmlFor={field("small-text")}>小字号</Label>
        <Switch id={field("small-text")} checked={typography.value.size === "14"} onCheckedChange={checked => typography.save({ ...typography.value, size: checked ? "14" : "16" })} /></div>
      <WebSettingSelect id={field("radius")} label="圆角" value={appearance.value.radius} onValueChange={radius => appearance.onChange({ ...appearance.value, radius })} options={[...(!PREVIEW_RADII.some(option => option.value === appearance.value.radius) ? [{ value: appearance.value.radius, label: getPreviewRadius(appearance.value.radius).title }] : []), ...PREVIEW_RADII.map(option => ({ value: option.value, label: option.title }))]} />
      {fonts.status !== "ready" && <div className="web-font-status" role="status"><p>{fonts.status === "failed" ? "所选字体暂时无法加载，当前使用回退字体。" : "正在加载所选字体，当前使用回退字体。"}</p>{fonts.status === "failed" && <Button variant="outline" size="sm" onClick={() => {
        fonts.retry();
        bodyFont.current?.focus();
      }}>重试加载字体</Button>}</div>}
      {workspaceAppearance?.error && <div role="status"><p>界面主题加载失败，当前界面仍可使用。</p><Button variant="outline" size="sm" onClick={workspaceAppearance.retry}>重试加载界面主题</Button></div>}
      {workspaceAppearance?.applied.themeFallback && <p role="status" className="text-sm text-secondary">所选界面主题暂不可用，当前使用兼容外观。</p>}
      {appearance.persistenceError && <p role="status" className="text-sm text-error">无法读取或保存外观设置；本次会话中的选择仍然有效。</p>}
    </CardContent></Card></section>}
    {showVaultDrawer && vaultPanelOpen !== null && <Suspense fallback={null}><WebMoreDrawer navigation={workspaceNavigation(s)} open={vaultPanelOpen} swipeDirection={s.isMobile ? "left" : "right"} onOpenChange={setVaultPanelOpen} finalFocus={vaultTrigger} /></Suspense>}
    <WebTypographySettings />
    {s.capabilities.has("openWeb") && <section aria-labelledby={field("web-heading")}><h2 id={field("web-heading")}>本机 Web</h2><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content"><div className="web-setting-block"><div className="web-setting-description"><p className="font-medium">浏览器访问</p><p>通过 MemoCard 菜单栏服务，在浏览器中打开统一的多笔记库界面。</p></div><Button disabled={s.working} onClick={() => void s.onOpenLocalWeb()}>在浏览器中打开</Button></div></CardContent></Card></section>}
    {s.environment?.platform === "mac" && s.capabilities.has("setMCPEnabled") && <section aria-labelledby={field("mcp-heading")}><h2 id={field("mcp-heading")}>MCP 本机读写</h2><Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content"><div className="web-setting-block"><div className="flex items-start justify-between gap-4"><div className="web-setting-description"><Label htmlFor={field("mcp")}>允许本机工具读写</Label><p>{s.environment.mcpEnabled && !s.environment.mcpWritesEnabled ? "当前仅读取。" : "写入时检查内容版本。"}</p></div><Switch id={field("mcp")} checked={s.environment.mcpWritesEnabled === true} onCheckedChange={() => void s.onToggleMCP()} disabled={!s.status?.connected || s.working} /></div>{s.environment.mcpEnabled && !s.environment.mcpWritesEnabled && <Button variant="outline" disabled={s.working} onClick={() => void s.onToggleMCP(false)}>关闭旧版读取</Button>}<p className="text-sm text-secondary">保持主客户端运行。可新建、修改、移入回收站和恢复笔记，不开放永久删除。</p>{s.working && <p role="status" className="web-settings-working"><Spinner aria-hidden="true" />正在更新连接…</p>}</div></CardContent></Card></section>}
  </div></div>;
}
