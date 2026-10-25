import "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    setReducedMotion: (value: "reduce" | "no-preference") => Promise<void>;
    setFontsOffline: (offline: boolean) => Promise<void>;
  }
}
