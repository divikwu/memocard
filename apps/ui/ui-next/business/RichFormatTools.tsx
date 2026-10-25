import type { ComponentProps } from 'react';
import { createRichFormatTools } from '../../src/rich-format-core';
import type { DialogContent } from '../components/dialog';
import { Sheet, SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from '../components/sheet';
import { Input } from '../components/input';
import { Button } from '../components/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/select';
import { cnState } from '../lib/utils';
import { richIcons } from './rich-icons';

function RichSelectContent({ className, ...props }: ComponentProps<typeof SelectContent>) {
  return <SelectContent {...props} className={cnState(className, 'next-rich-ui')} />;
}

function RichSheetContent({ className, style, ...props }: ComponentProps<typeof DialogContent>) {
  const sheetStyle = typeof style === 'object' ? style : undefined;
  return <SheetContent {...props} side="bottom" swipeToClose showCloseButton={false}
    className={cnState(className, 'next-rich-sheet')}
    style={{ ...sheetStyle, translate: undefined, bottom: sheetStyle?.bottom ? `max(0px, calc(${sheetStyle.bottom} - var(--spacing-1) * 3 - env(safe-area-inset-bottom)))` : 0 }} />;
}

function RichSheetHeader({ title }: { title: string; onClose: () => void }) {
  return <SheetHeader><SheetTitle>{title}</SheetTitle><SheetCloseButton aria-label="关闭弹窗" /></SheetHeader>;
}

export const RichFormatTools = createRichFormatTools({
  icons: richIcons, uiClassName: 'next-rich-ui',
  Dialog: Sheet, DialogContent: RichSheetContent, DialogTitle: SheetTitle, MobileDialogHeader: RichSheetHeader,
  Input, Button, Select, SelectContent: RichSelectContent, SelectItem, SelectTrigger, SelectValue,
});
