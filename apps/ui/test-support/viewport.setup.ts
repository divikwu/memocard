import { afterEach, expect, inject } from "vitest";

declare module "vitest" {
  interface ProvidedContext {
    storybookViewport: { width: number; height: number };
  }
}

// Storybook can resize the test frame after the browser provider starts it.
afterEach(() => {
  const viewport = inject("storybookViewport");
  expect(window.innerWidth).toBe(viewport.width);
  expect(window.innerHeight).toBe(viewport.height);
});
