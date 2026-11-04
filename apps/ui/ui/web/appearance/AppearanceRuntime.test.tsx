// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppearanceCatalogProvider, useAppearanceRuntime } from "./AppearanceRuntime";
import { appearanceCatalog, resolveAppearance } from "./catalog";
import type { AppearanceCatalog, LayoutAdapter } from "./contracts";

afterEach(cleanup);
const top: LayoutAdapter = { TopNavigation: () => <nav aria-label="加载后的导航" /> };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Harness({ requested = "classic", mobile = false, revision = 0, enabled = true, commit = vi.fn() }: { requested?: string; mobile?: boolean; revision?: number; enabled?: boolean; commit?: (id: string) => void }) {
  const runtime = useAppearanceRuntime({ requested, mobile, revision, enabled, commit });
  return <><output aria-label="应用状态">{JSON.stringify({ ...runtime.applied, adapter: undefined, pending: runtime.pending, error: runtime.error })}</output>
    {["classic", "minimal", "paper"].map(id => <button key={id} onClick={() => runtime.select(id)}>{id}</button>)}<button onClick={runtime.retry}>重试</button></>;
}
const state = () => JSON.parse(screen.getByLabelText("应用状态").textContent!);
function setup(catalog: AppearanceCatalog, props: Parameters<typeof Harness>[0] = {}) {
  const view = render(<AppearanceCatalogProvider catalog={catalog}><Harness {...props} /></AppearanceCatalogProvider>);
  return { ...view, update: (next: Parameters<typeof Harness>[0]) => view.rerender(<AppearanceCatalogProvider catalog={catalog}><Harness {...props} {...next} /></AppearanceCatalogProvider>) };
}
function catalogWith(load: () => Promise<LayoutAdapter>, styles = async () => {}) : AppearanceCatalog {
  return { ...appearanceCatalog, themes: { ...appearanceCatalog.themes, minimal: { ...appearanceCatalog.themes.minimal, loadStyles: styles }, paper: { ...appearanceCatalog.themes.minimal, loadStyles: async () => {} } }, layouts: { ...appearanceCatalog.layouts, topbar: { viewport: "desktop", load } } };
}

it("keeps the applied layout until both resources finish and shares one layout across visual themes", async () => {
  const code = deferred<LayoutAdapter>(); const css = deferred<void>();
  const load = vi.fn(() => code.promise); const styles = vi.fn(() => css.promise); const commit = vi.fn();
  setup(catalogWith(load, styles), { commit });
  fireEvent.click(screen.getByText("minimal"));
  await waitFor(() => expect(state().pending).toBe(true));
  await act(async () => { code.resolve(top); });
  expect(state().themeId).toBe("classic"); expect(commit).not.toHaveBeenCalled();
  await act(async () => { css.resolve(); });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "minimal", layoutId: "topbar", pending: false }));
  expect(commit).toHaveBeenLastCalledWith("minimal");
  fireEvent.click(screen.getByText("paper"));
  await waitFor(() => expect(state().themeId).toBe("paper"));
  expect(load).toHaveBeenCalledTimes(1);
});

it("ignores obsolete completion and failures during rapid theme choices", async () => {
  const previous = deferred<void>(); const commit = vi.fn();
  setup(catalogWith(async () => top, () => previous.promise), { commit });
  fireEvent.click(screen.getByText("minimal"));
  await waitFor(() => expect(state().pending).toBe(true));
  fireEvent.click(screen.getByText("paper"));
  await waitFor(() => expect(state().themeId).toBe("paper"));
  await act(async () => { previous.reject(new Error("late failure")); });
  expect(state()).toMatchObject({ themeId: "paper", error: false });
  expect(commit.mock.calls).toEqual([["paper"]]);
});

it("keeps navigation usable after failure and retries rejected resources", async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(top); const commit = vi.fn();
  setup(catalogWith(load), { commit });
  fireEvent.click(screen.getByText("minimal"));
  await waitFor(() => expect(state().error).toBe(true));
  expect(state().themeId).toBe("classic"); expect(commit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("重试"));
  await waitFor(() => expect(state().themeId).toBe("minimal"));
  expect(load).toHaveBeenCalledTimes(2); expect(commit).toHaveBeenCalledWith("minimal");
});

it("invalidates a pending selection when reset/storage revision changes even for the same stored id", async () => {
  const css = deferred<void>(); const commit = vi.fn();
  const view = setup(catalogWith(async () => top, () => css.promise), { commit });
  fireEvent.click(screen.getByText("minimal"));
  await waitFor(() => expect(state().pending).toBe(true));
  view.update({ requested: "classic", revision: 1 });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "classic", pending: false }));
  await act(async () => { css.resolve(); });
  expect(commit).not.toHaveBeenCalled(); expect(state().themeId).toBe("classic");
});

it("re-resolves an in-flight intent for the new viewport and commits through the latest callback", async () => {
  const css = deferred<void>(); const oldCommit = vi.fn(); const latestCommit = vi.fn();
  const view = setup(catalogWith(async () => top, () => css.promise), { commit: oldCommit });
  fireEvent.click(screen.getByText("minimal"));
  await waitFor(() => expect(state().pending).toBe(true));
  view.update({ mobile: true, commit: latestCommit });
  await act(async () => { css.resolve(); });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "minimal", layoutId: "drawer", pending: false }));
  expect(oldCommit).not.toHaveBeenCalled(); expect(latestCommit).toHaveBeenCalledWith("minimal");
});

it("separates unknown-theme fallback from unsupported-layout fallback without rewriting persisted requests", async () => {
  const commit = vi.fn();
  setup(appearanceCatalog, { requested: "future-theme", commit });
  await waitFor(() => expect(state().themeFallback).toBe("unknown"));
  expect(state().themeId).toBe("classic"); expect(commit).not.toHaveBeenCalled();
  const catalog = catalogWith(async () => top);
  const unavailable: AppearanceCatalog = { ...catalog, themes: { ...catalog.themes, paper: { ...catalog.themes.paper, layouts: { desktop: "missing", mobile: "drawer" } } } };
  expect(resolveAppearance(unavailable, "paper", false)).toMatchObject({ themeId: "paper", layoutId: "sidebar", layoutFallback: "unsupported-viewport", themeFallback: null });
});

it("does not load Web resources on native hosts and never commits after unmount", async () => {
  const css = deferred<void>(); const styles = vi.fn(() => css.promise); const commit = vi.fn();
  const view = setup(catalogWith(async () => top, styles), { requested: "minimal", enabled: false, commit });
  expect(styles).not.toHaveBeenCalled(); expect(state().layoutId).toBe("sidebar");
  view.update({ enabled: true });
  await waitFor(() => expect(styles).toHaveBeenCalled());
  view.unmount(); await act(async () => { css.resolve(); });
  expect(commit).not.toHaveBeenCalled();
});


it("keeps the usable visual theme for unknown requests while adapting its layout to mobile", async () => {
  const commit = vi.fn(); const view = setup(catalogWith(async () => top), { requested: "minimal", commit });
  await waitFor(() => expect(state().themeId).toBe("minimal"));
  view.update({ requested: "future-theme" });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "minimal", layoutId: "topbar", themeFallback: "unknown" }));
  view.update({ requested: "future-theme", mobile: true });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "minimal", layoutId: "drawer", themeFallback: "unknown" }));
  expect(commit).not.toHaveBeenCalled();
});


it("adapts the usable theme while another theme is loading or failed, retaining its retry intent", async () => {
  const css = deferred<void>();
  const catalog = catalogWith(async () => top);
  const styles = vi.fn().mockImplementationOnce(() => css.promise).mockResolvedValue(undefined);
  const commit = vi.fn();
  catalog.themes = { ...catalog.themes, paper: { ...catalog.themes.paper, loadStyles: styles } };
  const view = setup(catalog, { requested: "minimal", commit });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "minimal", layoutId: "topbar", pending: false }));
  fireEvent.click(screen.getByText("paper"));
  await waitFor(() => expect(state().pending).toBe(true));
  view.update({ requested: "minimal", mobile: true });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "minimal", layoutId: "drawer", pending: true }));
  await act(async () => { css.reject(new Error("paper offline")); });
  await waitFor(() => expect(state()).toMatchObject({ themeId: "minimal", layoutId: "drawer", pending: false, error: true }));
  expect(commit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("重试"));
  await waitFor(() => expect(state()).toMatchObject({ themeId: "paper", layoutId: "drawer", error: false }));
  expect(commit).toHaveBeenLastCalledWith("paper");
});
