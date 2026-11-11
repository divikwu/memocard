import { Suspense, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import { TagColorProvider } from "../../src/TagColorProvider";
import { normalizePropertyTag } from "../../src/inline-tags";
import { useIsMobile } from "../../src/hooks/use-mobile";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { Button } from "../components/button";
import { recoverableLazy } from "../components/recoverable-lazy";
import { TagIcon } from "./property-icon-catalog";
import "./tag.css";

const TagEditor = recoverableLazy(() => import("./tag-navigation-editor").then(module => ({ default: module.TagEditor })), "标签编辑");

export function TagOptionLabel({ tag, icon }: { tag: string; icon?: string }) {
  return <span className="ui-tag-option-label" data-tag={encodeURIComponent(tag)}>
    <TagIcon value={icon} />
    <span className="ui-tag-option-name">{tag}</span>
  </span>;
}

function TagOptionEditor({ tag, vaultId, anchor, disabled, onClose, onChangeTag }: {
  tag: string; vaultId?: string | null; anchor: HTMLButtonElement; disabled: boolean; onClose: () => void;
  onChangeTag?: (from: string, to: string | null) => Promise<void>;
}) {
  const mobile = useIsMobile();
  const { preferences, saveAppearance } = useTagPreferences(vaultId);
  async function save(name: string, icon?: string) {
    if (icon !== undefined) return saveAppearance(tag, tag, icon);
    const next = normalizePropertyTag(name);
    if (!next) throw new Error("请输入有效的标签名称。");
    if (next !== tag) await onChangeTag?.(tag, next);
  }
  return <TagColorProvider vaultId={vaultId}>
    <Suspense fallback={null}>
      <TagEditor path={tag} icon={preferences.icons[tag] ?? ""} anchor={anchor} mobile={mobile} title={`标签设置 ${tag}`}
        anchorIsTrigger initialPickerOpen appearanceOnly={!onChangeTag} busy={disabled} onClose={onClose}
        onSave={save}
        onDelete={onChangeTag && (() => onChangeTag(tag, null))} />
    </Suspense>
  </TagColorProvider>;
}

export function TagOptionSettings({ tag, vaultId, disabled, className, onChangeTag }: {
  tag: string; vaultId?: string | null; disabled: boolean; className: string;
  onChangeTag?: (from: string, to: string | null) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return <>
    <Button type="button" variant="ghost" size="icon-xs" className={className} disabled={disabled}
      aria-label={`管理标签 ${tag}`} aria-haspopup="dialog" aria-expanded={Boolean(anchor)}
      onClick={event => setAnchor(anchor ? null : event.currentTarget)}>
      <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" aria-hidden="true" strokeWidth={2} />
    </Button>
    {anchor && <TagOptionEditor tag={tag} vaultId={vaultId} anchor={anchor} disabled={disabled} onClose={() => setAnchor(null)} onChangeTag={onChangeTag} />}
  </>;
}
