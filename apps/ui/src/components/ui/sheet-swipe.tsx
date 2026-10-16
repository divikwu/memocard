import { useCallback } from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import "./sheet-swipe.css";

export default function SheetSwipe({ disabled }: { disabled: boolean }) {
  const isMobile = useIsMobile();
  const attach = useCallback((button: HTMLButtonElement | null) => button ? installSheetSwipe(button.parentElement!, () => button.click(), disabled) : undefined, [disabled]);
  return isMobile ? <><div data-slot="sheet-handle" aria-hidden="true" /><SheetPrimitive.Close ref={attach} hidden disabled={disabled} /></> : null;
}

function installSheetSwipe(popup: HTMLElement, close: () => void, disabled: boolean) {
  let drag: { id: number; x: number; y: number; distance: number } | null = null;
  function reset() {
    const active = drag;
    drag = null;
    popup.removeAttribute("data-sheet-dragging");
    popup.style.setProperty("--sheet-swipe-y", "0px");
    if (active && popup.hasPointerCapture(active.id)) popup.releasePointerCapture(active.id);
  }
  function start(event: PointerEvent) {
    if (disabled || drag || event.button !== 0 || event.isPrimary === false) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-slot="sheet-handle"], [data-slot="sheet-header"]') || target.closest('button, input, textarea, select, a, [contenteditable]')) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
    popup.setPointerCapture(event.pointerId);
    popup.setAttribute("data-sheet-dragging", "");
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    const x = event.clientX - drag.x;
    const y = event.clientY - drag.y;
    if (Math.abs(x) > 8 && Math.abs(x) > Math.abs(y)) { reset(); return; }
    drag.distance = Math.max(0, y);
    popup.style.setProperty("--sheet-swipe-y", `${drag.distance}px`);
  }
  function end(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    const threshold = Math.min(120, Math.max(64, popup.getBoundingClientRect().height / 4));
    const dismiss = drag.distance >= threshold;
    reset();
    if (dismiss) close();
  }
  popup.addEventListener("pointerdown", start);
  popup.addEventListener("pointermove", move);
  popup.addEventListener("pointerup", end);
  popup.addEventListener("pointercancel", reset);
  popup.addEventListener("lostpointercapture", reset);
  popup.setAttribute("data-sheet-swipe", "");
  popup.toggleAttribute("data-swipe-disabled", disabled);
  popup.setAttribute("data-swipe-ready", "");
  return () => {
    popup.removeEventListener("pointerdown", start);
    popup.removeEventListener("pointermove", move);
    popup.removeEventListener("pointerup", end);
    popup.removeEventListener("pointercancel", reset);
    popup.removeEventListener("lostpointercapture", reset);
    popup.removeAttribute("data-swipe-ready");
    popup.removeAttribute("data-sheet-swipe");
    popup.removeAttribute("data-swipe-disabled");
    reset();
  };
}
