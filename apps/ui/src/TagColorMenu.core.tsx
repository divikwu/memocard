import type { ComponentType, ComponentProps } from "react";
import { useSyncExternalStore } from 'react';
import { useTagColorVault } from './TagColorProvider';
import { parseTagColors, readTagColors, setTagColor, subscribeTagColors } from './tag-colors';
import { normalizePropertyTag, tagKey } from './inline-tags';

type View = {
  PropertyOptionMenu: ComponentType<ComponentProps<typeof import("@ui/business/property-editors")["PropertyOptionMenu"]>>;
};

export function createTagColorMenu(view: View) {
  const { PropertyOptionMenu } = view;
function TagColorMenu({tag, disabled, swatch, onChangeTag, onDelete}: {tag:string; disabled:boolean; swatch?:boolean; onChangeTag?:(from:string,to:string | null)=>Promise<void>; onDelete?:()=>Promise<void>}) {
  tag = tagKey(tag);
  const vaultId = useTagColorVault();
  const raw = useSyncExternalStore(subscribeTagColors, () => readTagColors(vaultId));
  const colors = parseTagColors(raw);
  const color = Object.hasOwn(colors, tag) ? colors[tag] : 'default';
  return <PropertyOptionMenu name={tag} kind="标签" color={color} disabled={disabled} swatch={swatch} normalizeName={normalizePropertyTag} onChangeName={onChangeTag} onDelete={onDelete}
    onChangeColor={color => {
      try { setTagColor(vaultId, tag, color); }
      catch { throw new Error('无法保存标签颜色，请检查浏览器存储权限。'); }
    }}
    deleteDescription={`将从笔记属性和标签群组中移除「${tag}」。正文中会保留标签文字并去掉 #。`} />;
}

  return TagColorMenu;
}
