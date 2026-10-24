import { test } from "vitest";
import { commands } from "vitest/browser";

for (const id of ["domain-tokens", "theme-definition"] as const) for (const width of [320, 1024] as const) for (const theme of ["light", "dark"] as const) {
  test(`${id} Docs ${width}px ${theme}: theme isolation, complete previews and usable examples`, async () => {
    await commands.verifyTokenDocs({ id, width, theme });
  }, 60000);
}
