import { fireEvent } from "@testing-library/react";

export function swipeSheet(target: Element, distance: number, cancel = false) {
  const popup = target.closest('[role="dialog"]') as HTMLElement;
  let captured: number | null = null;
  popup.setPointerCapture = id => { captured = id; };
  popup.hasPointerCapture = id => captured === id;
  popup.releasePointerCapture = () => { captured = null; };
  function send(type: string, y: number) {
    fireEvent(target, Object.assign(new MouseEvent(type, {bubbles:true,button:0,clientX:100,clientY:y}), {pointerId:1,isPrimary:true}));
  }
  send("pointerdown", 100);
  send("pointermove", 100 + distance);
  send(cancel ? "pointercancel" : "pointerup", 100 + distance);
}
