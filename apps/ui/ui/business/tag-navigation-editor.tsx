import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { defaultRangeExtractor, observeElementRect, useVirtualizer } from "@tanstack/react-virtual";
import { HugeiconsIcon } from "@hugeicons/react";
import Airplane01Icon from "@hugeicons/core-free-icons/Airplane01Icon";
import BulbIcon from "@hugeicons/core-free-icons/BulbIcon";
import Flag01Icon from "@hugeicons/core-free-icons/Flag01Icon";
import PawPrintIcon from "@hugeicons/core-free-icons/PawPrintIcon";
import ShapesIcon from "@hugeicons/core-free-icons/ShapesIcon";
import SmileIcon from "@hugeicons/core-free-icons/SmileIcon";
import SpoonAndForkIcon from "@hugeicons/core-free-icons/SpoonAndForkIcon";
import TrophyIcon from "@hugeicons/core-free-icons/TrophyIcon";
import emojiData from "../../src/lib/emoji-zh.json";
import { errorMessage } from "../../src/bridge";
import { tagKey } from "../../src/inline-tags";
import type { TagColor } from "../../src/tag-colors";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";
import { NameEditor } from "./NameEditor";
import { useScrollOverflow } from "../hooks/use-scroll-overflow";
import { IconOptions } from "./PropertyIconPicker";
import { TagIcon } from "./property-icon-catalog";
import { PropertyOptionMenu, TagColorMenu } from "./property-editors";
import { cn } from "../lib/utils";
import "./sidebar.css";

const categories = {
  smileys_people: { label: "表情与人物", icon: SmileIcon },
  animals_nature: { label: "动物与自然", icon: PawPrintIcon },
  food_drink: { label: "食物与饮料", icon: SpoonAndForkIcon },
  travel_places: { label: "旅行与地点", icon: Airplane01Icon },
  activities: { label: "活动", icon: TrophyIcon },
  objects: { label: "物品", icon: BulbIcon },
  symbols: { label: "符号", icon: ShapesIcon },
  flags: { label: "旗帜", icon: Flag01Icon },
};
const emojis = emojiData.emojis as Record<string, { n: string[]; u: string }[]>;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const nativeEmoji = (code: string) => String.fromCodePoint(...code.split("-").map(value => parseInt(value, 16)));
const isSingleEmoji = (value: string) => value.length <= 32 && [...segmenter.segment(value)].length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(value);

function submitEmojiSearch(event: React.KeyboardEvent<HTMLInputElement>, query: string, onSelect: (emoji: string) => void) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const value = query.trim();
  if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && isSingleEmoji(value)) onSelect(value);
}

export function EmojiPicker({ selected, disabled, onSelect, autoFocus = false, search }: { selected: string; disabled: boolean; onSelect: (emoji: string) => void; autoFocus?: boolean; search?: { query: string; onChange: (query: string) => void } }) {
  const [localQuery, setLocalQuery] = useState("");
  const embedded = search !== undefined;
  const query = search?.query ?? localQuery;
  const setQuery = search?.onChange ?? setLocalQuery;
  const [category, setCategory] = useState("smileys_people");
  const custom = query.trim();
  const needle = custom.toLocaleLowerCase();
  const customEmoji = isSingleEmoji(custom);
  const items = useMemo(() => needle
    ? Object.values(emojis).flat().filter(item => nativeEmoji(item.u) === custom || item.n.some(name => name.toLocaleLowerCase().includes(needle)))
    : emojis[category], [category, custom, needle]);
  const [geometry, setGeometry] = useState({ columns: 8, tile: 36, gap: 4, padding: 4 });
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const { columns, tile, gap, padding } = geometry;
  const [grid, setGrid] = useScrollOverflow(`${items.length}:${columns}:${tile}`);
  const rowCount = Math.ceil(items.length / columns);
  const rows = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rowCount,
    getScrollElement: () => grid,
    estimateSize: () => tile,
    gap,
    paddingStart: padding,
    overscan: 2,
    initialRect: { width: 0, height: 240 },
    useAnimationFrameWithResizeObserver: true,
    observeElementRect: (instance, notify) => observeElementRect(instance, rect => {
      const element = instance.scrollElement;
      if (!rect.width || !rect.height || !element) return;
      const style = getComputedStyle(element);
      const tileSize = parseFloat(style.gridAutoRows);
      const columnGap = parseFloat(style.columnGap);
      const width = Math.min(element.clientWidth, parseFloat(style.width));
      const next = {
        columns: Math.max(1, Math.floor((width + columnGap) / (tileSize + columnGap))),
        tile: tileSize,
        gap: parseFloat(style.rowGap),
        padding: parseFloat(style.paddingTop),
      };
      if (next.tile > 0) setGeometry(current => current.columns === next.columns && current.tile === next.tile && current.gap === next.gap && current.padding === next.padding ? current : next);
      notify(rect);
    }),
    rangeExtractor: range => {
      const visible = defaultRangeExtractor(range);
      if (focusedRow === null || focusedRow >= rowCount || visible.includes(focusedRow)) return visible;
      return [...visible, focusedRow].sort((a, b) => a - b);
    },
  });
  useLayoutEffect(() => { rows.measure(); }, [rows, tile]);
  useLayoutEffect(() => {
    if (grid) grid.scrollTop = 0;
  }, [grid, category, needle]);
  return <section aria-label="选择图标" className="ui-sidebar-emoji-picker">
    {!embedded && <div className="flex items-center justify-between"><span className="text-xs font-normal text-secondary">选择图标</span><Button type="button" size="xs" variant="ghost" aria-label="清除图标" disabled={disabled || !selected} onClick={() => onSelect("")}>清除</Button></div>}
    {!embedded && <Input autoFocus={autoFocus} aria-label="搜索 Emoji" placeholder="搜索 Emoji" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} onKeyDown={event => submitEmojiSearch(event, query, onSelect)} />}
    {customEmoji && !items.length && <Button type="button" variant="outline" disabled={disabled} onClick={() => onSelect(custom)}>使用 <span className="ui-sidebar-emoji">{custom}</span></Button>}
    <div ref={setGrid} role="group" aria-label="Emoji" className={cn("ui-sidebar-emoji-grid icon-picker-scroll-fade", embedded && "note-property-icon-grid")}
      style={{ gridTemplateRows: rowCount ? `repeat(${rowCount}, ${tile}px)` : undefined }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedRow(null); }}>
      {rows.getVirtualItems().flatMap(({ index }) => items.slice(index * columns, (index + 1) * columns).map((item, column) => {
        const emoji = nativeEmoji(item.u);
        return <Button key={item.u} type="button" size={embedded ? "icon-sm" : "icon"} variant="ghost" className={cn("text-xl", selected === emoji && "bg-control")}
          style={{ gridRow: index + 1, gridColumn: column + 1 }} aria-label={item.n.join("、")} aria-pressed={selected === emoji} disabled={disabled}
          onFocus={() => setFocusedRow(index)} onClick={() => onSelect(emoji)}><span className="ui-sidebar-emoji">{emoji}</span></Button>;
      }))}
    </div>
    {!items.length && !customEmoji && <p role="status" className="text-sm text-secondary">没有匹配的 Emoji</p>}
    <TooltipProvider><div role="group" aria-label="Emoji 分类" className="ui-sidebar-emoji-categories">{Object.entries(categories).map(([key, { label, icon }]) => <Tooltip key={key}><TooltipTrigger render={<Button type="button" size={embedded ? "icon-sm" : "icon"} variant="ghost" className={cn("text-icon-secondary", category === key && !needle && "bg-control text-primary")} aria-label={`Emoji 分类：${label}`} aria-pressed={category === key && !needle} disabled={disabled} onClick={() => { setCategory(key); setQuery(""); }}><HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" /></Button>} /><TooltipContent>{label}</TooltipContent></Tooltip>)}</div></TooltipProvider>
  </section>;
}

export function TagEditor({ path, icon, anchor, mobile, onClose, onSave, onDelete, title, appearanceOnly, busy, finalFocus, initialPickerOpen = false, anchorIsTrigger = false, groupAppearance }: {
  path: string; icon: string; anchor: HTMLElement; mobile: boolean;
  onClose: () => void;
  onSave: (name: string, icon?: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  title?: string;
  appearanceOnly?: boolean;
  busy?: boolean;
  finalFocus?: () => HTMLElement | false;
  initialPickerOpen?: boolean;
  anchorIsTrigger?: boolean;
  groupAppearance?: { icon: React.ReactNode; color?: TagColor; onChangeColor: (color: TagColor) => Promise<void> };
}) {
  const pickerId = useId();
  const [iconError, setIconError] = useState("");
  const pendingIcon = useRef<Promise<void> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(mobile || initialPickerOpen);
  const [pickerTab, setPickerTab] = useState<React.ComponentProps<typeof Tabs>["value"]>("emoji");
  const [pickerQuery, setPickerQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  const restorePickerFocus = useRef(false);
  const navigation = useRef(anchor.closest('[data-slot="sidebar-content"]'));
  const savedPath = useRef(path);
  useLayoutEffect(() => {
    if (pickerOpen && !mobile && !initialPickerOpen) search.current?.focus({ preventScroll: true });
    if (!pickerOpen && restorePickerFocus.current) {
      const frame = requestAnimationFrame(() => {
        restorePickerFocus.current = false;
        const trigger = pickerTrigger.current;
        if (!trigger) return;
        const { activeElement, body } = trigger.ownerDocument;
        if (activeElement === body || trigger.ownerDocument.getElementById(pickerId)?.contains(activeElement)) {
          trigger.focus({ preventScroll: true });
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [pickerOpen, mobile, initialPickerOpen, pickerId]);
  const returnFocus = () => {
    if (anchor.isConnected) return anchor;
    const buttons = [...navigation.current?.querySelectorAll<HTMLButtonElement>("button") ?? []];
    return buttons.find(button => button.getAttribute("aria-label") === savedPath.current) ?? buttons[0] ?? false;
  };
  const rename = async (name: string) => {
    await onSave(name);
    savedPath.current = tagKey(name);
  };
  const selectIcon = (value: string) => {
    restorePickerFocus.current = true;
    setPickerOpen(false);
    if (value === icon) return;
    setIconError("");
    const pending = onSave(path, value);
    pendingIcon.current = pending;
    void pending.catch(cause => {
      if (pendingIcon.current === pending) setIconError(errorMessage(cause));
    });
  };
  const togglePicker = () => {
    if (!pickerOpen) {
      setPickerTab("emoji");
      setPickerQuery("");
    }
    setPickerOpen(!pickerOpen);
  };
  const emoji = icon.startsWith("icon:") ? "" : icon;
  const searchLabel = pickerTab === "emoji" ? "搜索 Emoji" : "搜索图标";
  return <NameEditor initialName={path} anchor={anchor} anchorIsTrigger={anchorIsTrigger} sheet={mobile} busy={busy}
    title={title ?? (groupAppearance ? "编辑群组图标" : "编辑标签")} inputLabel={groupAppearance ? "群组名称" : "标签名称"} maxLength={groupAppearance ? 80 : undefined} readOnlyName={appearanceOnly}
    side="right" align="start" initialFocus={initialPickerOpen ? () => search.current : undefined} finalFocus={finalFocus ?? returnFocus}
    onClose={onClose} onSave={rename}
    trailing={disabled => groupAppearance
      ? <PropertyOptionMenu name={path} kind="群组" color={groupAppearance.color ?? "default"} disabled={disabled} swatch
          normalizeName={tagKey} onChangeColor={groupAppearance.onChangeColor} />
      : <TagColorMenu tag={path} disabled={disabled} swatch onDelete={onDelete} />}
    leading={disabled => <Button ref={pickerTrigger} type="button" variant="secondary" size="icon-sm"
      className={cn("note-property-icon-trigger border-0", groupAppearance?.color && `note-tag-color-${groupAppearance.color}`)}
      data-tag={groupAppearance ? undefined : encodeURIComponent(tagKey(path))} data-group-icon={groupAppearance && ""}
      aria-label="更换图标" aria-expanded={pickerOpen} aria-controls={pickerOpen ? pickerId : undefined} disabled={disabled} onClick={togglePicker}>
      <TagIcon value={icon} fallback={groupAppearance?.icon} />
    </Button>}
  >
    {disabled => <Collapsible.Root open={pickerOpen} className="tag-icon-disclosure">
        {iconError && <p role="alert" className="mt-2 px-1 text-sm text-error">{iconError}</p>}
        <Collapsible.Panel id={pickerId} render={<section />} aria-label={groupAppearance ? "群组图标选项" : "标签图标选项"} aria-hidden={!pickerOpen || undefined} inert={disabled || !pickerOpen} className="tag-icon-disclosure-panel">
          <div className="note-property-icon-picker">
            <Tabs value={pickerTab} onValueChange={value => { setPickerTab(value); setPickerQuery(""); }} className="tag-icon-tabs">
              <div className="flex items-center justify-between gap-1">
                <TabsList variant="line" aria-label={groupAppearance ? "群组图标类型" : "标签图标类型"}>
                  <TabsTrigger value="emoji">Emoji</TabsTrigger>
                  <TabsTrigger value="icon">图标</TabsTrigger>
                </TabsList>
                <Button type="button" size="sm" variant="ghost" className="px-2 text-secondary" disabled={disabled || !icon} onClick={() => selectIcon("")}>清除图标</Button>
              </div>
              <div className="tag-icon-tab-body">
                <Input ref={search} className="px-2" aria-label={searchLabel} placeholder={searchLabel} value={pickerQuery} disabled={disabled} onChange={event => setPickerQuery(event.target.value)} onKeyDown={pickerTab === "emoji" ? event => submitEmojiSearch(event, pickerQuery, selectIcon) : undefined} />
                <TabsContent value="icon"><IconOptions selected={icon} disabled={disabled} query={pickerQuery} onSelect={selectIcon} /></TabsContent>
                <TabsContent value="emoji"><EmojiPicker selected={emoji} disabled={disabled} search={{ query: pickerQuery, onChange: setPickerQuery }} onSelect={selectIcon} /></TabsContent>
              </div>
            </Tabs>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>}
  </NameEditor>;
}
