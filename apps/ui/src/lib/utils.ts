import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: ["element-xs", "element-sm", "element-md", "element-lg", "textarea"] },
    classGroups: {
      size: [{ size: ["xs", "sm", "md", "lg"] }],
      "inset-shadow": ["input-state", { "inset-shadow": ["hover", "selected", "success", "warning", "error"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
