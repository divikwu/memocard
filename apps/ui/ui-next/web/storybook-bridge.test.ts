import { afterEach, expect, it } from "vitest";
import * as bridge from "../../.storybook/bridge";

afterEach(() => bridge.resetStorybookBridge());

it("exposes temporary browser and local service modes and restores nested scopes", () => {
  const browser = bridge.setStorybookClientMode("browser");
  expect(bridge.isBrowserVault).toBe(true);
  expect(bridge.isLocalWeb).toBe(false);
  const local = bridge.setStorybookClientMode("local-web");
  expect(bridge.isBrowserVault).toBe(false);
  expect(bridge.isLocalWeb).toBe(true);
  local();
  expect(bridge.isBrowserVault).toBe(true);
  expect(bridge.isLocalWeb).toBe(false);
  browser();
  expect(bridge.isBrowserVault).toBe(false);
});

it("does not restore an already cleaned mode or revive scopes after bridge reset", () => {
  const browser = bridge.setStorybookClientMode("browser");
  const local = bridge.setStorybookClientMode("local-web");
  browser();
  expect(bridge.isLocalWeb).toBe(true);
  local();
  expect(bridge.isBrowserVault).toBe(false);
  const stale = bridge.setStorybookClientMode("local-web");
  bridge.resetStorybookBridge();
  const current = bridge.setStorybookClientMode("browser");
  stale();
  expect(bridge.isBrowserVault).toBe(true);
  expect(bridge.isLocalWeb).toBe(false);
  current();
});

it("keeps asset browser mode and in-memory connection lifetime independent", async () => {
  const asset = new Blob(["fixture"]);
  const clearAsset = bridge.setStorybookBrowserAssets({ "assets/test.png": asset });
  expect(bridge.isBrowserVault).toBe(true);
  expect(bridge.isConnectedClient).toBe(false);
  const clearLocal = bridge.setStorybookClientMode("local-web");
  expect(bridge.isBrowserVault).toBe(false);
  const clearRequest = bridge.setStorybookRequestHandler(() => ({ isolated: true }));
  expect(await bridge.request("fixtureOnly")).toEqual({ isolated: true });
  expect(bridge.isConnectedClient).toBe(true);
  clearLocal();
  expect(bridge.isBrowserVault).toBe(true);
  expect(await bridge.readBrowserAsset("assets/test.png")).toBe(asset);
  clearAsset(); clearRequest();
  expect(bridge.isBrowserVault).toBe(false);
  expect(bridge.isLocalWeb).toBe(false);
  expect(bridge.isConnectedClient).toBe(false);
  await expect(bridge.request("fixtureOnly")).rejects.toThrow("no data operation");
});
