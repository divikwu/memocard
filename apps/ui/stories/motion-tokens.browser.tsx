import "../.storybook/preview.css";
import "../src/quick-capture.css";
import "../src/import-layout.css";
import "../src/components/ui/sheet-swipe.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { commands } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { Button } from "../src/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../src/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "../src/components/ui/sheet";
import { Popover, PopoverContent } from "../src/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider } from "../src/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "../src/components/ui/dropdown-menu";
import { Skeleton } from "../src/components/ui/skeleton";
import { SidebarExample } from "./sidebar.example";
import { sidebarArgs } from "./sidebar.fixtures";

const standard = "cubic-bezier(0.4, 0, 0.2, 1)";
let rootStyle: string;
beforeEach(() => { rootStyle = document.documentElement.style.cssText; });
afterEach(async () => { cleanup(); document.documentElement.style.cssText = rootStyle; await commands.setReducedMotion("no-preference"); });

// Frozen pre-migration computed values, independent of the token definitions.
for (const preference of ["no-preference", "reduce"] as const) {
  test(`preserves transitions, pulse and local reduced-motion rules: ${preference}`, async () => {
    await commands.setReducedMotion(preference);
    const view = render(<>
      <Button>Action</Button><Skeleton />
      <div className="quick-capture-group" />
      <div data-sheet-swipe="" />
      <div className="note-image-trigger" data-image-state="loading" />
      <SidebarExample {...sidebarArgs({ vaultId: "motion-regression" })} />
    </>);
    const style = (selector: string, pseudo?: string) => getComputedStyle(view.container.querySelector(selector)!, pseudo);
    const reduced = preference === "reduce";
    expect(parseFloat(style('[data-slot="button"]').transitionDuration)).toBe(reduced ? 0.00001 : 0.15);
    expect(style('[data-slot="button"]').transitionTimingFunction).toBe(standard);
    expect(style('[data-slot="skeleton"]').animationName).toBe(reduced ? "none" : "pulse");
    if (!reduced) {
      expect(style('[data-slot="skeleton"]').animationDuration).toBe("2s");
      expect(style('[data-slot="skeleton"]').animationTimingFunction).toBe("cubic-bezier(0.4, 0, 0.6, 1)");
    }
    for (const [selector, easing] of [[".quick-capture-group", "ease-out"], ["[data-sheet-swipe]", "cubic-bezier(0.22, 1, 0.36, 1)"]]) {
      expect(parseFloat(style(selector).transitionDuration)).toBe(reduced ? 0.00001 : 0.18);
      expect(style(selector).transitionTimingFunction).toBe(reduced ? "ease" : easing);
      expect(style(selector).transitionProperty).toBe(reduced ? "none" : selector.startsWith(".") ? "box-shadow" : "translate");
    }
    const image = style(".note-image-trigger", "::after");
    expect(image.animationName).toBe(reduced ? "none" : "pulse");
    if (!reduced) {
      expect(image.animationDuration).toBe("2s");
      expect(image.animationTimingFunction).toBe("cubic-bezier(0.4, 0, 0.6, 1)");
    }
    expect(parseFloat(style('[data-slot="sidebar-gap"]').transitionDuration)).toBe(reduced ? 0.00001 : 0.2);
    expect(style('[data-slot="sidebar-gap"]').transitionTimingFunction).toBe("linear");
    if (!reduced) {
      const root = document.documentElement.style;
      for (const name of ["fast", "normal", "panel", "pulse"]) root.setProperty(`--motion-duration-${name}`, "333ms");
      for (const name of ["standard", "out", "linear", "rebound", "pulse"]) root.setProperty(`--motion-ease-${name}`, "linear");
      for (const selector of ['[data-slot="button"]', ".quick-capture-group", "[data-sheet-swipe]", '[data-slot="sidebar-gap"]']) {
        expect(style(selector).transitionDuration).toBe("0.333s");
        expect(style(selector).transitionTimingFunction).toBe("linear");
      }
      expect(style('[data-slot="skeleton"]').animationDuration).toBe("0.333s");
      expect(style('[data-slot="skeleton"]').animationTimingFunction).toBe("linear");
      expect(style(".note-image-trigger", "::after").animationDuration).toBe("0.333s");
      expect(style(".note-image-trigger", "::after").animationTimingFunction).toBe("linear");
    } else {
      document.documentElement.style.setProperty("--motion-duration-reduced", "0.02ms");
      expect(parseFloat(style('[data-slot="button"]').transitionDuration)).toBe(0.00002);
    }
  });

  for (const [name, content, selector, duration, easing] of [
    ["dialog", <Dialog defaultOpen><DialogContent><DialogTitle>Dialog</DialogTitle></DialogContent></Dialog>, '[data-slot="dialog-content"]', "0.2s", "ease"],
    ["sheet", <Sheet defaultOpen><SheetContent><SheetTitle>Sheet</SheetTitle></SheetContent></Sheet>, '[data-slot="sheet-content"]', "0.2s", standard],
    ["popover", <Popover defaultOpen><PopoverContent>Popover</PopoverContent></Popover>, '[data-slot="popover-content"]', "0.15s", "ease"],
    ["tooltip", <TooltipProvider><Tooltip defaultOpen><TooltipContent>Tooltip</TooltipContent></Tooltip></TooltipProvider>, '[data-slot="tooltip-content"]', "0.15s", "ease"],
    ["menu", <DropdownMenu defaultOpen><DropdownMenuContent><DropdownMenuItem>Item</DropdownMenuItem></DropdownMenuContent></DropdownMenu>, '[data-slot="dropdown-menu-content"]', "0.15s", "ease"],
  ] as const) test(`preserves ${name} enter / exit timing: ${preference}`, async () => {
    await commands.setReducedMotion(preference);
    render(content);
    await expect.poll(() => document.querySelector(selector)).not.toBeNull();
    const element = document.querySelector(selector)!;
    for (const state of ["open", "closed"]) {
      element.removeAttribute(state === "open" ? "data-closed" : "data-open");
      element.setAttribute(`data-${state}`, "");
      const style = getComputedStyle(element);
      expect(style.animationName).toBe(state === "open" ? "enter" : "exit");
      expect(parseFloat(style.animationDuration)).toBe(preference === "reduce" ? 0.00001 : parseFloat(duration));
      expect(style.animationTimingFunction).toBe(easing);
      if (name === "sheet") {
        expect(parseFloat(style.transitionDuration)).toBe(preference === "reduce" ? 0.00001 : parseFloat(duration));
        expect(style.transitionTimingFunction).toBe(standard);
      }
    }
    if (preference === "no-preference") {
      const root = document.documentElement.style;
      root.setProperty(duration === "0.2s" ? "--motion-duration-panel" : "--motion-duration-fast", "333ms");
      root.setProperty(name === "sheet" ? "--motion-ease-standard" : "--motion-ease-popup", "linear");
      expect(getComputedStyle(element).animationDuration).toBe("0.333s");
      expect(getComputedStyle(element).animationTimingFunction).toBe("linear");
    }
  });
}
