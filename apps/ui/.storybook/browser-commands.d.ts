import "vitest/browser";
import type { DocsFontCase } from "./docs-font-regression";
import type { ComponentFontCase } from "./component-font-regression";
import type { FoundationReferenceCase } from "./foundation-reference-regression";
import type { TokenDocsCase } from "./token-docs-regression";

declare module "vitest/browser" {
  interface BrowserCommands {
    setColorScheme: (value: "light" | "dark") => Promise<void>;
    setPointerPressed: (pressed: boolean) => Promise<void>;
    tabThroughControls: () => Promise<void>;
    setReducedMotion: (value: "reduce" | "no-preference") => Promise<void>;
    verifyDocsFont: (options: DocsFontCase) => Promise<{ states: number; subsets: number; fontBytes: number }>;
    verifyComponentFont: (options: ComponentFontCase) => Promise<{ states: number; subsets: number }>;
    verifyFoundationReference: (options: FoundationReferenceCase) => Promise<{ definitions: number; sections: number }>;
    verifyTokenDocs: (options: TokenDocsCase) => Promise<void>;
  }
}
