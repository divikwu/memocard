import { useCallback } from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { useIsMobile } from "../hooks/use-mobile";
import { installSheetSwipe } from "../../src/sheet-swipe";
import "./sheet-swipe.css";

export default function SheetSwipe({ disabled }: { disabled: boolean }) {
  const isMobile = useIsMobile();
  const attach = useCallback((button: HTMLButtonElement | null) => button ? installSheetSwipe(button.parentElement!, () => button.click(), disabled) : undefined, [disabled]);
  return isMobile ? <><div data-slot="sheet-handle" aria-hidden="true" /><SheetPrimitive.Close ref={attach} hidden disabled={disabled} /></> : null;
}
