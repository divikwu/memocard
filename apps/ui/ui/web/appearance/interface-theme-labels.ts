export const interfaceThemeLabels = {
  classic: "经典",
  minimal: "轻简",
} as const;

export const DEFAULT_INTERFACE_THEME = "minimal" satisfies keyof typeof interfaceThemeLabels;
