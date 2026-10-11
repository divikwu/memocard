import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTagColorVault } from './TagColorProvider';
import { parseTagColors, readTagColors, subscribeTagColors } from './tag-colors';
import './tag-colors.css';

export default function TagColorStyles() {
  const vaultId = useTagColorVault();
  const raw = useSyncExternalStore(subscribeTagColors, () => readTagColors(vaultId));

  const rules = Object.entries(parseTagColors(raw)).map(([tag, color]) =>
    `[data-tag="${encodeURIComponent(tag)}"]{--tag-bg:var(--tag-${color}-bg);--tag-fg:var(--tag-${color}-fg)}`
  ).join('\n');
  return createPortal(<style data-tag-colors="">{rules}</style>, document.head);
}
