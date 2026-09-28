import { afterEach, expect, it, vi } from "vitest";
import { createId } from "./uuid";

afterEach(() => vi.unstubAllGlobals());

it("creates a version 4 UUID when a custom WebKit scheme has no randomUUID", () => {
  vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) });
  expect(createId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
});
