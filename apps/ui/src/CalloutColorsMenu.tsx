import type { Editor } from '@tiptap/react';
import { Menu } from '@base-ui/react/menu';
import { Check, ChevronRight, Paintbrush } from 'lucide-react';
import { calloutColors } from './import-layout';
import { updateCallout } from './rich-callout';

const labels = ['默认', '灰色', '棕色', '橙色', '黄色', '绿色', '蓝色', '紫色', '粉色', '红色'];

export function CalloutColorsMenu({ editor, pos, onClose }: { editor: Editor; pos: number; onClose: () => void }) {
  const node = editor.state.doc.nodeAt(pos);
  return <Menu.SubmenuRoot>
    <Menu.SubmenuTrigger><Paintbrush aria-hidden="true" /><span>颜色</span><ChevronRight className="rich-menu-check" aria-hidden="true" /></Menu.SubmenuTrigger>
    <Menu.Portal><Menu.Positioner collisionPadding={12} sideOffset={6} alignOffset={-5} className="z-50"><Menu.Popup className="rich-block-menu rich-callout-colors" aria-label="标注颜色">
      {(['textColor', 'color'] as const).map(attr => <Menu.Group key={attr}>
        <Menu.GroupLabel className="rich-callout-color-label">{attr === 'color' ? '背景颜色' : '文字颜色'}</Menu.GroupLabel>
        <Menu.RadioGroup value={node?.attrs[attr] ?? 'default'} onValueChange={value => { updateCallout(editor, pos, { [attr]: attr === 'textColor' && value === 'default' ? null : value }); onClose(); }}>
          {calloutColors.map((value, index) => <Menu.RadioItem key={value} value={value}>
            <span className="rich-callout-swatch" aria-hidden="true" style={{ color: value === 'default' ? 'var(--foreground)' : `var(--callout-swatch-${value})`, background: attr === 'textColor' || value === 'default' ? 'var(--background)' : `var(--callout-background-${value})` }}>{attr === 'textColor' ? 'A' : null}</span>
            <span>{labels[index]}{attr === 'color' ? '背景' : '文字'}</span><Menu.RadioItemIndicator className="rich-menu-check"><Check aria-hidden="true" /></Menu.RadioItemIndicator>
          </Menu.RadioItem>)}
        </Menu.RadioGroup>
      </Menu.Group>)}
    </Menu.Popup></Menu.Positioner></Menu.Portal>
  </Menu.SubmenuRoot>;
}
