import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { EmojiPickerPanel } from '@/components/emoji-picker-panel';
import { updateCallout } from './rich-callout';
import type { CalloutIconTarget } from './rich-callout-view';
import './callout-icon-picker.css';

export function CalloutIconPicker({ editor, target, onClose }: { editor: Editor; target: CalloutIconTarget; onClose: () => void }) {
  const [error, setError] = useState('');
  useEffect(() => {
    target.anchor.setAttribute('aria-expanded', 'true');
    return () => target.anchor.setAttribute('aria-expanded', 'false');
  }, [target]);
  function apply(icon: string | null) {
    const pos = target.getPos();
    if (!editor.isEditable || !target.anchor.isConnected || pos === undefined || editor.state.doc.nodeAt(pos)?.type.name !== 'aside') { setError('标注已变化，请关闭后重新打开。'); return; }
    updateCallout(editor, pos, { icon });
    onClose();
  }
  const pos = target.getPos();
  const selected = pos === undefined ? '' : String(editor.state.doc.nodeAt(pos)?.attrs.icon ?? '');
  return <Popover open onOpenChange={open => { if (!open) onClose(); }}>
    <PopoverContent anchor={target.anchor} align="start" aria-label="编辑标注图标" className="callout-icon-picker" initialFocus={false} finalFocus={type => type === 'mouse' || type === 'touch' ? false : target.anchor.isConnected ? target.anchor : editor.view.dom}>
      <EmojiPickerPanel selected={selected} onSelect={emoji => apply(emoji || null)} />
      {error && <p role="alert">{error}</p>}
    </PopoverContent>
  </Popover>;
}
