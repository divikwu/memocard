import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: ["element-sm", "element-md", "element-lg"], ease: ["standard"] },
    classGroups: {
      duration: [{ duration: ["fast-min", "fast", "fast-max", "medium-min", "medium", "slow"] }],
      shadow: ["surface-floating", { shadow: ["med", "control", "floating", "document", "card-hover", "input-focus"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cnState<State>(
  className: string | ((state: State) => string | undefined) | undefined,
  ...baseClasses: ClassValue[]
) {
  return typeof className === "function"
    ? (state: State) => cn(...baseClasses, className(state))
    : cn(...baseClasses, className);
}
