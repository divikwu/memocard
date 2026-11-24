import type { ComponentProps } from 'react';
import { PopoverPortal } from '../components/popover';
import { createRichFormatTools } from '../../src/rich-format-core';
import type { DialogContent } from '../components/dialog';
import { Sheet, SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from '../components/sheet';
import { Input } from '../components/input';
import { Button } from '../components/button';
import { ActionGroup, useMobileActionGroup } from '../components/action-group';
import { cnState } from '../lib/utils';
import TextSuperscriptIcon from "@hugeicons/core-free-icons/TextSuperscriptIcon";
import TextSubscriptIcon from "@hugeicons/core-free-icons/TextSubscriptIcon";
import TextBoldIcon from "@hugeicons/core-free-icons/TextBoldIcon";
import TextItalicIcon from "@hugeicons/core-free-icons/TextItalicIcon";
import TextStrikethroughIcon from "@hugeicons/core-free-icons/TextStrikethroughIcon";
import Unlink01Icon from "@hugeicons/core-free-icons/Unlink01Icon";
import RemoveFormattingIcon from "@hugeicons/core-free-icons/RemoveFormattingIcon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import { richIcon, richIcons } from './rich-icons';
import './rich-link.css';

function RichSheetContent({ className, style, ...props }: ComponentProps<typeof DialogContent>) {
  const sheetStyle = typeof style === 'object' ? style : undefined;
  return <SheetContent {...props} side="bottom" swipeToClose showCloseButton={false}
    className={cnState(className, 'ui-rich-sheet')}
    style={{ ...sheetStyle, translate: undefined, bottom: sheetStyle?.bottom ? `max(0px, calc(${sheetStyle.bottom} - var(--spacing-1) * 3 - env(safe-area-inset-bottom)))` : 0 }} />;
}

function RichSheetHeader({ title }: { title: string; onClose: () => void }) {
  return <SheetHeader><SheetTitle>{title}</SheetTitle><SheetCloseButton aria-label="关闭弹窗" /></SheetHeader>;
}

function RichToolbar(props: ComponentProps<'div'>) {
  const grouped = useMobileActionGroup();
  return grouped ? <ActionGroup {...props} /> : <div {...props} />;
}

export const RichFormatTools = createRichFormatTools({
  PopoverPortal, icons: {
    ...richIcons,
    Superscript: richIcon(TextSuperscriptIcon),
    Subscript: richIcon(TextSubscriptIcon),
    Bold: richIcon(TextBoldIcon),
    Italic: richIcon(TextItalicIcon),
    Strikethrough: richIcon(TextStrikethroughIcon),
    Unlink: richIcon(Unlink01Icon),
    RemoveFormatting: richIcon(RemoveFormattingIcon),
    Globe: richIcon(Globe02Icon),
  }, uiClassName: 'ui-rich-ui',
  Dialog: Sheet, DialogContent: RichSheetContent, DialogTitle: SheetTitle, MobileDialogHeader: RichSheetHeader,
  Toolbar: RichToolbar,
  Input, Button,
});
