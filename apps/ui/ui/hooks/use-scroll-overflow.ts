import { useLayoutEffect, useState } from "react";

export function useScrollOverflow(contentKey: string | number) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!element) return;
    const updateEdges = () => {
      element.toggleAttribute("data-overflow-top", element.scrollTop > 1);
      element.toggleAttribute("data-overflow-bottom", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
    };
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    element.addEventListener("scroll", updateEdges, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", updateEdges); };
  }, [element, contentKey]);
  return [element, setElement] as const;
}
