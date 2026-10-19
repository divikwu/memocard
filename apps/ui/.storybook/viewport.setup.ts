import { afterEach, expect, inject } from "vitest";

declare module "vitest" {
  interface ProvidedContext {
    storybookViewport: { width: number; height: number };
  }
}

// The Storybook addon resizes after Vitest's browser config. Check the real frame.
afterEach(() => {
  const viewport = inject("storybookViewport");
  expect(window.innerWidth).toBe(viewport.width);
  expect(window.innerHeight).toBe(viewport.height);
});
