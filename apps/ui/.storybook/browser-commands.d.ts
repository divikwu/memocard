import "vitest/browser";
import type { DocsFontCase } from "./docs-font-regression";
import type { ComponentFontCase } from "./component-font-regression";

declare module "vitest/browser" {
  interface BrowserCommands {
    setReducedMotion: (value: "reduce" | "no-preference") => Promise<void>;
    verifyDocsFont: (options: DocsFontCase) => Promise<{ states: number; subsets: number; fontBytes: number }>;
    verifyComponentFont: (options: ComponentFontCase) => Promise<{ states: number; subsets: number }>;
  }
}
