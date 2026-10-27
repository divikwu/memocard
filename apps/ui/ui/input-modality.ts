import { useEffect } from "react";

let consumers = 0;
let release: (() => void) | undefined;

// One tracker per page, including nested theme providers and portalled fields.
export function useInputModality() {
  useEffect(() => {
    if (consumers++ === 0) {
      const root = document.documentElement;
      const previous = root.getAttribute("data-ui-input-modality");
      const set = (mode: "pointer" | "keyboard") => {
        if (root.dataset.uiInputModality !== mode) root.dataset.uiInputModality = mode;
      };
      let keyboardOrigin: EventTarget | null = null;
      const keyDown = (event: KeyboardEvent) => {
        if (event.isComposing || ["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
        keyboardOrigin = event.target;
        const field = event.target instanceof Element ? event.target.closest("input, textarea, [contenteditable=true]") : null;
        const editing = field && !field.matches("input:is([type=checkbox], [type=radio], [type=range], [type=button], [type=submit], [type=reset], [type=file], [type=color])");
        const navigatingOptions = field?.getAttribute("role") === "combobox" && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key);
        const submitting = event.key === "Enter" && field?.tagName === "INPUT";
        if (event.key === "Tab" || event.key === "Escape" || !editing || navigatingOptions || submitting) set("keyboard");
      };
      const pointerDown = () => { keyboardOrigin = null; set("pointer"); };
      // Keyboard shortcuts can move focus without using Tab (for example search).
      const focusIn = (event: FocusEvent) => { if (keyboardOrigin && event.target !== keyboardOrigin) set("keyboard"); };
      set("pointer");
      document.addEventListener("keydown", keyDown, true);
      document.addEventListener("pointerdown", pointerDown, true);
      document.addEventListener("focusin", focusIn, true);
      release = () => {
        document.removeEventListener("keydown", keyDown, true);
        document.removeEventListener("pointerdown", pointerDown, true);
        document.removeEventListener("focusin", focusIn, true);
        if (previous === null) root.removeAttribute("data-ui-input-modality");
        else root.setAttribute("data-ui-input-modality", previous);
      };
    }
    return () => { if (--consumers === 0) { release?.(); release = undefined; } };
  }, []);
}
