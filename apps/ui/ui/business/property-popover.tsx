import { createContext, useContext, useState, type ComponentProps } from 'react';
import { useIsMobile } from '../../src/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '../components/popover';
import { Sheet, SheetCloseButton, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/sheet';

const MobilePropertyContext = createContext(false);

// Keep the property controllers' submit, cancellation and focus contracts while
// presenting their controlled popovers as modal sheets on H5.
export function PropertyPopover(props: ComponentProps<typeof Popover>) {
  const mobile = useIsMobile();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(props.defaultOpen ?? false);
  const open = props.open ?? uncontrolledOpen;
  const [session, setSession] = useState({ open, mobile });
  // Keep the closing root and its trigger mounted; adapt when the next session opens.
  if (session.open !== open) setSession({ open, mobile: open ? mobile : session.mobile });
  const presentation = session.mobile;
  const onOpenChange: ComponentProps<typeof Popover>['onOpenChange'] = (next, details) => {
    props.onOpenChange?.(next, details);
    if (!details.isCanceled && props.open === undefined) setUncontrolledOpen(next);
  };
  return <MobilePropertyContext.Provider value={presentation}>{presentation
    ? <Sheet open={open} onOpenChange={onOpenChange} onOpenChangeComplete={props.onOpenChangeComplete}>{props.children}</Sheet>
    : <Popover {...props} open={open} onOpenChange={onOpenChange} />}</MobilePropertyContext.Provider>;
}

export function PropertyPopoverTrigger(props: Omit<ComponentProps<typeof PopoverTrigger>, 'handle' | 'openOnHover' | 'delay' | 'closeDelay'>) {
  const mobile = useContext(MobilePropertyContext);
  return mobile ? <SheetTrigger {...props} /> : <PopoverTrigger {...props} />;
}

export function PropertyPopoverContent(props: ComponentProps<typeof PopoverContent>) {
  const mobile = useContext(MobilePropertyContext);
  if (!mobile) return <PopoverContent {...props} />;
  const title = props['aria-label'] ?? '编辑属性';
  return <SheetContent side="bottom" className="ui-property-sheet" showCloseButton={false} swipeToClose
    initialFocus={props.initialFocus} finalFocus={props.finalFocus} aria-describedby={undefined}>
    <SheetHeader><SheetTitle>{title}</SheetTitle><SheetCloseButton aria-label={`关闭${title}`} /></SheetHeader>
    <div className={`ui-property-sheet-body ${typeof props.className === 'string' ? props.className : ''}`} onKeyDown={props.onKeyDown}>
      {props.children}
    </div>
  </SheetContent>;
}
