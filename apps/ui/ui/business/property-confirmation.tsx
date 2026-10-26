import { Children, type ComponentProps } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { useIsMobile } from '../../src/hooks/use-mobile';
import { SheetCloseButton, SheetHeader, SheetPopup } from '../components/sheet';
import { cnState } from '../lib/utils';

// AlertDialog retains its dismissal and confirmation semantics; only its shell changes.
export function PropertyConfirmationPopup({ children, className, ...props }: ComponentProps<typeof AlertDialog.Popup>) {
  const mobile = useIsMobile();
  if (!mobile) return <AlertDialog.Popup {...props} className={className}>{children}</AlertDialog.Popup>;
  const [title, ...body] = Children.toArray(children);
  return <SheetPopup {...props} side="bottom" swipeToClose showCloseButton={false} className={cnState(className, 'ui-property-confirm-sheet')}>
    <SheetHeader>{title}<SheetCloseButton aria-label="取消确认" /></SheetHeader>
    <div className="ui-property-confirm-body">{body}</div>
  </SheetPopup>;
}
