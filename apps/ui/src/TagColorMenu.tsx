import { useSyncExternalStore } from 'react';
import { useTagColorVault } from './TagColorProvider';
import { parseTagColors, readTagColors, setTagColor, subscribeTagColors } from './tag-colors';
import { normalizePropertyTag, tagKey } from './inline-tags';
import PropertyOptionMenu from './PropertyOptionMenu';

export default function TagColorMenu({tag, disabled, onChangeTag}: {tag:string; disabled:boolean; onChangeTag?:(from:string,to:string | null)=>Promise<void>}) {
  tag = tagKey(tag);
  const vaultId = useTagColorVault();
  const raw = useSyncExternalStore(subscribeTagColors, () => readTagColors(vaultId));
  const colors = parseTagColors(raw);
  const color = Object.hasOwn(colors, tag) ? colors[tag] : 'default';
  return <PropertyOptionMenu name={tag} kind="标签" color={color} disabled={disabled} normalizeName={normalizePropertyTag} onChangeName={onChangeTag}
    onChangeColor={color => {
      try { setTagColor(vaultId, tag, color); }
      catch { throw new Error('无法保存标签颜色，请检查浏览器存储权限。'); }
    }}
    deleteDescription={`将从库内所有笔记属性中移除此标签。正文中的 #${tag}、笔记和子标签保留；有子标签时，父级仍会显示。`} />;
}
