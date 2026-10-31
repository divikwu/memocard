import "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    setReducedMotion: (value: "reduce" | "no-preference") => Promise<void>;
    setForcedColors: (value: "active" | "none") => Promise<void>;
    setFontsOffline: (offline: boolean) => Promise<void>;
    pressLeftMouseButton: () => Promise<void>;
    releaseLeftMouseButton: () => Promise<void>;
  }
}

declare module "vitest" {
  interface ProvidedContext {
    uiQualityTouch: boolean;
  }
}
