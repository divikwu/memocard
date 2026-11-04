// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewModeProvider } from "../preview-mode";
import { StorybookAppearanceBridge } from "./StorybookAppearanceBridge";
import { useWebAppearance } from "./WebAppearance";
import { AppearanceCatalogProvider, useAppearanceRuntime } from "./appearance/AppearanceRuntime";
import { appearanceCatalog } from "./appearance/catalog";
import type { AppearanceCatalog } from "./appearance/contracts";

const channel = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn() }));
vi.mock("storybook/preview-api", () => ({ addons: { getChannel: () => channel } }));
vi.mock("../preview-fonts", async original => ({ ...await original(), loadPreviewFonts: vi.fn().mockResolvedValue([]) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness() {
  const appearance = useWebAppearance()!;
  const runtime = useAppearanceRuntime({ requested: appearance.value.interfaceTheme, revision: appearance.themeRevision, mobile: false, enabled: true, commit: id => appearance.setInterfaceTheme!(id) });
  return <><button onClick={() => runtime.select("minimal")}>简约</button><button onClick={() => appearance.onChange({ ...appearance.value, bodyFont: "geist" })}>字体</button><output>{runtime.applied.themeId}</output></>;
}

it("commits an interface theme without republishing a font change awaiting toolbar acknowledgement", async () => {
  let finish!: () => void;
  const css = new Promise<void>(resolve => { finish = resolve; });
  const catalog: AppearanceCatalog = { ...appearanceCatalog, themes: { ...appearanceCatalog.themes, minimal: { ...appearanceCatalog.themes.minimal, loadStyles: () => css } }, layouts: { ...appearanceCatalog.layouts, topbar: { viewport: "desktop", load: async () => ({ TopNavigation: () => null }) } } };
  render(<PreviewModeProvider mode="light"><StorybookAppearanceBridge><AppearanceCatalogProvider catalog={catalog}><Harness /></AppearanceCatalogProvider></StorybookAppearanceBridge></PreviewModeProvider>);
  fireEvent.click(screen.getByText("简约"));
  fireEvent.click(screen.getByText("字体"));
  expect(channel.emit.mock.calls.at(-1)?.[1].globals.bodyFont).toBe("geist");
  const publications = channel.emit.mock.calls.length;
  await act(async () => { finish(); });
  await waitFor(() => expect(screen.getByText("minimal", { selector: "output" })).toBeDefined());
  expect(channel.emit).toHaveBeenCalledTimes(publications);
});
