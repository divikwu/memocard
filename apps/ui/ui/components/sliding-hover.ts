import { useState, type CSSProperties, type PointerEvent } from "react";

import "./sliding-hover.css";

type HoverStyle = CSSProperties & {
  "--hover-translate": string;
  "--hover-width"?: string;
  "--hover-height"?: string;
};

export function useSlidingHover(axis: "x" | "y" = "y") {
  const [style, setStyle] = useState<HoverStyle>();
  return {
    "data-hovering": style ? "" : undefined,
    style,
    onPointerOver: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
      const item = event.target.closest<HTMLElement>(':is(button,[role="menuitem"],[role="menuitemradio"]):not([data-disabled])');
      if (!item || item.parentElement !== event.currentTarget || item.matches(":disabled, [aria-disabled=true]")) return;
      if (axis === "y") {
        setStyle({ "--hover-translate": `0 ${item.offsetTop}px` });
        return;
      }
      const bounds = item.getBoundingClientRect();
      const width = getComputedStyle(item).width;
      // Keep fractional positions in the row's coordinates while the popup scales in.
      const scale = bounds.width / Number.parseFloat(width);
      const group = event.currentTarget;
      const offset = (bounds.left - group.getBoundingClientRect().left) / scale + group.scrollLeft;
      setStyle({
        "--hover-translate": `${offset}px 0`,
        "--hover-width": width,
        "--hover-height": "100%",
      });
    },
    onPointerLeave: () => setStyle(undefined),
  };
}
