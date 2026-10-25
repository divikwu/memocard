import "../.storybook/preview.css";
import "../src/Editor.css";
import "../src/rich-editor.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { Check } from "lucide-react";
import { Input } from "../src/components/ui/input";
import { Textarea } from "../src/components/ui/textarea";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "../src/components/ui/input-group";
import { Alert, AlertDescription, AlertTitle } from "../src/components/ui/alert";
import { Badge } from "../src/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "../src/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "../src/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem } from "../src/components/ui/dropdown-menu";
import { Switch } from "../src/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { Select, SelectTrigger, SelectValue } from "../src/components/ui/select";
import { cleanup, render } from "@testing-library/react";
import { Button } from "../src/components/ui/button";
import { Skeleton } from "../src/components/ui/skeleton";
import { colorPixel, contrastRatio, measurePair } from "./foundation-color-contrast";
import { NEUTRAL_VALUES, PALETTE_VALUES } from "../src/features/theme/preferences";

const root = document.documentElement;
let attributes: (string | null)[];
const names = ["class", "data-palette", "data-neutral-palette", "style"];
beforeEach(() => { attributes = names.map(name => root.getAttribute(name)); });
afterEach(async () => {
  await commands.setPointerPressed(false);
  cleanup();
  names.forEach((name, index) => {
    const value = attributes[index];
    if (value === null) root.removeAttribute(name); else root.setAttribute(name, value);
  });
});

// Role ownership is checked independently from the Tailwind aliases.
const roles = [
  ["text-primary", "color", "--foreground"],
  ["text-secondary", "color", "--muted-foreground"],
  ["text-accent", "color", "--text-accent-color"],
  ["text-icon-accent", "color", "--accent-text"],
  ["text-icon-primary", "color", "--icon-primary-color"],
  ["text-icon-secondary", "color", "--icon-secondary-color"],
  ["bg-body", "backgroundColor", "--background"],
  ["bg-card", "backgroundColor", "--card"],
  ["text-on-card", "color", "--card-foreground"],
  ["bg-popover", "backgroundColor", "--popover"],
  ["text-on-popover", "color", "--popover-foreground"],
  ["bg-muted", "backgroundColor", "--muted"],
  ["bg-surface", "backgroundColor", "--surface-bg"],
  ["text-on-surface", "color", "--surface-foreground"],
  ["bg-inverted", "backgroundColor", "--inverted-bg"],
  ["text-on-inverted", "color", "--inverted-foreground"],
  ["bg-error-inverted", "backgroundColor", "--error-inverted-bg"],
  ["text-on-dark", "color", "--on-dark-color"],
  ["text-on-light", "color", "--on-light-color"],
  ["bg-tint-hover", "backgroundColor", "--tint-hover-color"],
  ["bg-shadow", "backgroundColor", "--shadow-color"],
  ["bg-overlay", "backgroundColor", "--overlay-bg"],
  ["bg-track", "backgroundColor", "--track-bg"],
  ["bg-accent-muted", "backgroundColor", "--accent-muted-bg"],
  ["bg-accent-bg", "backgroundColor", "--primary"],
  ["text-on-accent", "color", "--primary-foreground"],
  ["bg-neutral", "backgroundColor", "--secondary"],
  ["text-on-neutral", "color", "--secondary-foreground"],
  ["bg-state", "backgroundColor", "--accent"],
  ["text-on-state", "color", "--accent-foreground"],
  ["bg-overlay-hover", "backgroundColor", "--hover-bg"],
  ["bg-skeleton", "backgroundColor", "--skeleton-bg"],
  ["text-disabled", "color", "--text-disabled-color"],
  ["text-icon-disabled", "color", "--icon-disabled-color"],
  ["bg-overlay-pressed", "backgroundColor", "--pressed-bg"],
  ["text-error", "color", "--destructive"],
  ["bg-error-muted", "backgroundColor", "--error-muted"],
  ["text-on-error", "color", "--error-foreground"],
  ["text-success", "color", "--success"],
  ["bg-success-muted", "backgroundColor", "--success-muted"],
  ["text-on-success", "color", "--success-foreground"],
  ["text-warning", "color", "--warning"],
  ["bg-warning-muted", "backgroundColor", "--warning-muted"],
  ["text-on-warning", "color", "--warning-foreground"],
  ["border-border", "borderColor", "--border"],
  ["border-border-emphasized", "borderColor", "--border-emphasized-color"],
  ["border-border-strong", "borderColor", "--border-emphasized-color"],
  ["border-input", "borderColor", "--input"],
  ["border-focus", "borderColor", "--focus-outline-color"],
  ["bg-sidebar", "backgroundColor", "--sidebar"],
  ["text-sidebar-text", "color", "--sidebar-foreground"],
  ["bg-sidebar-hover", "backgroundColor", "--sidebar-accent"],
  ["text-sidebar-on-hover", "color", "--sidebar-accent-foreground"],
  ["border-sidebar-focus", "borderColor", "--focus-outline-color"],
] as const;

for (const mode of ["light", "dark"]) for (const palette of PALETTE_VALUES) for (const neutral of NEUTRAL_VALUES) {
  test(`preserves color roles: ${mode} / ${palette} / ${neutral}`, () => {
    root.classList.toggle("dark", mode === "dark");
    root.dataset.palette = palette;
    root.dataset.neutralPalette = neutral;
    const view = render(<>
      {roles.map(([className, property, variable]) => <div key={className}>
        <span data-actual={className} className={className} />
        <span data-expected={className} style={{ [property]: `var(${variable})` }} />
      </div>)}
      <Button data-testid="accent">Action</Button>
      <Button data-testid="neutral" variant="secondary">Secondary</Button>
      <Button data-testid="link" variant="link">Link</Button>
      <Skeleton data-testid="skeleton" />
      <Button data-testid="disabled" disabled><Check />Disabled</Button>
      <div className="bg-body">
        {(["success", "warning", "destructive"] as const).map(variant => <Alert key={variant} variant={variant} data-testid={`status-${variant}`}>
          <Check /><AlertTitle>{variant}</AlertTitle><AlertDescription>Description</AlertDescription>
        </Alert>)}
        <Button variant="destructive" data-testid="error-fill">Delete</Button>
        <Badge variant="destructive" data-testid="error-badge">Error</Badge>
        <Badge variant="success" data-testid="success-fill">Success</Badge>
        <Badge variant="warning" data-testid="warning-fill">Warning</Badge>
      </div>
    </>);
    for (const [className, property] of roles) {
      const actual = getComputedStyle(view.container.querySelector(`[data-actual="${className}"]`)!)[property];
      const expected = getComputedStyle(view.container.querySelector(`[data-expected="${className}"]`)!)[property];
      expect(actual, className).toBe(expected);
    }
    const matches = (id: string, property: "color" | "backgroundColor", role: string) => {
      expect(getComputedStyle(view.getByTestId(id))[property]).toBe(getComputedStyle(view.container.querySelector(`[data-actual="${role}"]`)!)[property]);
    };
    matches("accent", "backgroundColor", "bg-accent-bg");
    matches("accent", "color", "text-on-accent");
    matches("neutral", "backgroundColor", "bg-neutral");
    matches("neutral", "color", "text-on-neutral");
    matches("link", "color", "text-accent");
    matches("skeleton", "backgroundColor", "bg-skeleton");
    const action = getComputedStyle(view.getByTestId("accent"));
    expect(contrastRatio(colorPixel(action.color), colorPixel(action.backgroundColor)), "filled action text").toBeGreaterThanOrEqual(4.5);
    for (const surface of ["bg-body", "bg-card", "bg-popover"]) {
      const background = colorPixel(getComputedStyle(view.container.querySelector(`[data-actual="${surface}"]`)!).backgroundColor);
      expect(contrastRatio(colorPixel(getComputedStyle(view.getByTestId("link")).color), background), `accent link on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colorPixel(getComputedStyle(view.container.querySelector('[data-actual="text-icon-accent"]')!).color), background), `accent icon on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    const focus = colorPixel(getComputedStyle(view.container.querySelector('[data-actual="border-focus"]')!).borderColor);
    for (const surface of ["bg-body", "bg-card", "bg-popover", "bg-sidebar"]) {
      const background = colorPixel(getComputedStyle(view.container.querySelector(`[data-actual="${surface}"]`)!).backgroundColor);
      expect(contrastRatio(focus, background), `focus on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    matches("disabled", "color", "text-disabled");
    expect(getComputedStyle(view.getByTestId("disabled")).opacity).toBe("1");
    expect(getComputedStyle(view.getByTestId("disabled").querySelector("svg")!).color).toBe(getComputedStyle(view.container.querySelector('[data-actual="text-icon-disabled"]')!).color);
    for (const variant of ["success", "warning", "destructive"] as const) {
      const alert = view.getByTestId(`status-${variant}`), status = variant === "destructive" ? "error" : variant;
      expect(getComputedStyle(alert).color).toBe(getComputedStyle(view.container.querySelector(`[data-actual="text-${status}"]`)!).color);
      expect(getComputedStyle(alert.querySelector('[data-slot="alert-description"]')!).color).toBe(getComputedStyle(alert).color);
      expect(measurePair(alert).ratio, `${status} text on muted`).toBeGreaterThanOrEqual(4.5);
    }
    for (const id of ["success-fill", "warning-fill", "error-fill", "error-badge"]) expect(measurePair(view.getByTestId(id)).ratio, id).toBeGreaterThanOrEqual(4.5);
  });
}

test("overrides ordinary icons independently while preserving status and disabled icons", () => {
  root.style.setProperty("--icon-primary-color", "rgb(21 43 65)");
  root.style.setProperty("--icon-secondary-color", "rgb(76 98 120)");
  root.style.setProperty("--icon-disabled-color", "rgb(151 152 153)");
  const view = render(<>
    <InputGroup><InputGroupAddon><Check data-testid="addon-icon" />Label</InputGroupAddon><InputGroupInput aria-label="Input" /></InputGroup>
    <Select defaultValue="one" items={[{ value: "one", label: "One" }]}><SelectTrigger data-testid="icon-select"><SelectValue /></SelectTrigger></Select>
    <DropdownMenu defaultOpen><DropdownMenuContent>
      <DropdownMenuItem data-testid="menu-icon"><Check />Ordinary</DropdownMenuItem>
      <DropdownMenuItem data-testid="status-icon" variant="destructive"><Check />Delete</DropdownMenuItem>
      <DropdownMenuItem disabled data-testid="disabled-icon"><Check />Disabled</DropdownMenuItem>
      <DropdownMenuItem disabled variant="destructive" data-testid="disabled-error-icon"><Check />Disabled delete</DropdownMenuItem>
      <DropdownMenuCheckboxItem checked data-testid="primary-icon">Checked</DropdownMenuCheckboxItem>
    </DropdownMenuContent></DropdownMenu>
  </>);
  expect(getComputedStyle(view.getByTestId("addon-icon")).color).toBe("rgb(76, 98, 120)");
  for (const id of ["icon-select", "menu-icon"]) expect(getComputedStyle(view.getByTestId(id).querySelector("svg")!).color).toBe("rgb(76, 98, 120)");
  expect(getComputedStyle(view.getByTestId("primary-icon").querySelector("svg")!).color).toBe("rgb(21, 43, 65)");
  expect(getComputedStyle(view.getByTestId("status-icon").querySelector("svg")!).color).toBe(getComputedStyle(view.getByTestId("status-icon")).color);
  for (const id of ["disabled-icon", "disabled-error-icon"]) expect(getComputedStyle(view.getByTestId(id).querySelector("svg")!).color).toBe("rgb(151, 152, 153)");
});

test("uses surface and overlay tokens through dialog and sheet portals", () => {
  root.style.setProperty("--surface-bg", "rgb(12 34 56)");
  root.style.setProperty("--surface-foreground", "rgb(210 220 230)");
  root.style.setProperty("--overlay-bg", "rgba(45, 67, 89, 0.5)");
  root.style.setProperty("--shadow-high", "rgb(12, 34, 56) 0px 7px 13px 0px");
  const verify = (slot: string) => {
    expect(getComputedStyle(document.querySelector(`[data-slot="${slot}-content"]`)!).backgroundColor).toBe("rgb(12, 34, 56)");
    expect(getComputedStyle(document.querySelector(`[data-slot="${slot}-content"]`)!).color).toBe("rgb(210, 220, 230)");
    expect(getComputedStyle(document.querySelector(`[data-slot="${slot}-overlay"]`)!).backgroundColor).toBe("rgba(45, 67, 89, 0.5)");
    if (slot === "dialog") expect(getComputedStyle(document.querySelector('[data-slot="dialog-content"]')!).boxShadow).toContain("rgb(12, 34, 56) 0px 7px 13px 0px");
  };
  render(<Dialog defaultOpen><DialogContent><DialogTitle>Dialog</DialogTitle></DialogContent></Dialog>);
  verify("dialog");
  cleanup();
  render(<Sheet defaultOpen><SheetContent><SheetTitle>Sheet</SheetTitle></SheetContent></Sheet>);
  verify("sheet");
});

test("keeps tooltip inversion and unchecked switch tracks independent", async () => {
  root.style.setProperty("--inverted-bg", "rgb(12 34 56)");
  root.style.setProperty("--inverted-foreground", "rgb(210 220 230)");
  root.style.setProperty("--track-bg", "rgb(76 98 120)");
  const view = render(<>
    <TooltipProvider><Tooltip defaultOpen><TooltipTrigger>Help</TooltipTrigger><TooltipContent>Tooltip</TooltipContent></Tooltip></TooltipProvider>
    <Switch aria-label="Off" data-testid="off" /><Switch aria-label="On" defaultChecked data-testid="on" />
  </>);
  await expect.poll(() => document.querySelector('[data-slot="tooltip-content"]')).toBeTruthy();
  const popup = document.querySelector('[data-slot="tooltip-content"]')!;
  expect(getComputedStyle(popup).backgroundColor).toBe("rgb(12, 34, 56)");
  expect(getComputedStyle(popup).color).toBe("rgb(210, 220, 230)");
  expect(getComputedStyle(popup.querySelector('[data-slot="tooltip-arrow"]')!).fill).toBe("rgb(12, 34, 56)");
  expect(getComputedStyle(view.getByTestId("off")).backgroundColor).toBe("rgb(76, 98, 120)");
  expect(getComputedStyle(view.getByTestId("on")).backgroundColor).not.toBe("rgb(76, 98, 120)");
});

test("propagates status overrides to alerts and destructive fills", () => {
  root.style.setProperty("--success", "rgb(12 34 56)");
  root.style.setProperty("--success-muted", "rgb(210 220 230)");
  root.style.setProperty("--success-foreground", "rgb(131 132 133)");
  root.style.setProperty("--warning", "rgb(65 43 21)");
  root.style.setProperty("--warning-muted", "rgb(230 220 210)");
  root.style.setProperty("--warning-foreground", "rgb(141 142 143)");
  root.style.setProperty("--error-foreground", "rgb(101 102 103)");
  const view = render(<>
    <Alert variant="success" data-testid="success"><Check /><AlertTitle>Success</AlertTitle><AlertDescription>Saved</AlertDescription></Alert>
    <Alert variant="warning" data-testid="warning"><Check /><AlertTitle>Warning</AlertTitle><AlertDescription>Check</AlertDescription></Alert>
    <Button variant="destructive" data-testid="button"><Check />Delete</Button>
    <Badge variant="destructive" data-testid="badge">Error</Badge>
    <Badge variant="success" data-testid="success-badge">Success</Badge>
    <Badge variant="warning" data-testid="warning-badge">Warning</Badge>
  </>);
  for (const [id, color, background] of [["success", "rgb(12, 34, 56)", "rgb(210, 220, 230)"], ["warning", "rgb(65, 43, 21)", "rgb(230, 220, 210)"]]) {
    const alert = view.getByTestId(id);
    expect(getComputedStyle(alert).color).toBe(color);
    expect(getComputedStyle(alert).backgroundColor).toBe(background);
    expect(getComputedStyle(alert.querySelector("svg")!).color).toBe(color);
    expect(getComputedStyle(alert.querySelector('[data-slot="alert-description"]')!).color).toBe(color);
  }
  for (const id of ["button", "badge"]) expect(getComputedStyle(view.getByTestId(id)).color).toBe("rgb(101, 102, 103)");
  for (const [id, color, background] of [["success-badge", "rgb(131, 132, 133)", "rgb(12, 34, 56)"], ["warning-badge", "rgb(141, 142, 143)", "rgb(65, 43, 21)"]]) {
    expect(getComputedStyle(view.getByTestId(id)).color).toBe(color);
    expect(getComputedStyle(view.getByTestId(id)).backgroundColor).toBe(background);
  }
});

test("uses validation and selection insets without duplicating group or keyboard focus feedback", async () => {
  const shadows = {
    hover: "inset 0 0 0 3px rgb(12 34 56)",
    selected: "inset 0 0 0 4px rgb(23 45 67)",
    success: "inset 0 0 0 5px rgb(34 56 78)",
    warning: "inset 0 0 0 6px rgb(45 67 89)",
    error: "inset 0 0 0 7px rgb(56 78 90)",
  };
  for (const [state, shadow] of Object.entries(shadows)) root.style.setProperty(`--shadow-inset-${state}`, shadow);
  const view = render(<>
    <Input data-testid="normal-inset" aria-label="Normal" />
    <Input data-testid="success-inset" aria-label="Success" data-validation="success" />
    <Textarea data-testid="warning-inset" aria-label="Warning" data-validation="warning" />
    <Input data-testid="error-inset" aria-label="Error" aria-invalid="true" data-validation="warning" />
    <Input disabled data-testid="disabled-inset" aria-label="Disabled" />
    <Input aria-invalid="true" className="inset-shadow-none" data-testid="override-inset" aria-label="Custom validation" />
    <InputGroup data-testid="group-inset"><InputGroupInput data-testid="inner-inset" aria-label="Invalid group" aria-invalid="true" /></InputGroup>
    <Button variant="outline" aria-pressed="true" data-testid="selected-inset">Selected</Button>
    <Button variant="outline" aria-pressed="true" className="aria-pressed:inset-shadow-none" data-testid="override-selected">Custom selected</Button>
    {Object.entries(shadows).map(([state, shadow]) => <span key={state} data-testid={`expected-${state}`} style={{ boxShadow: shadow }} />)}
  </>);
  const expected = (state: string) => getComputedStyle(view.getByTestId(`expected-${state}`)).boxShadow;
  for (const [id, state] of [["success-inset", "success"], ["warning-inset", "warning"], ["error-inset", "error"], ["group-inset", "error"], ["selected-inset", "selected"]]) {
    expect(getComputedStyle(view.getByTestId(id)).boxShadow, id).toContain(expected(state));
  }
  expect(getComputedStyle(view.getByTestId("inner-inset")).boxShadow).not.toContain(expected("error"));
  expect(getComputedStyle(view.getByTestId("override-inset")).boxShadow).not.toContain(expected("error"));
  expect(getComputedStyle(view.getByTestId("override-selected")).boxShadow).not.toContain(expected("selected"));
  await userEvent.hover(view.getByTestId("normal-inset"));
  await expect.poll(() => getComputedStyle(view.getByTestId("normal-inset")).boxShadow).toContain(expected("hover"));
  await userEvent.hover(view.getByTestId("error-inset"));
  await expect.poll(() => getComputedStyle(view.getByTestId("error-inset")).boxShadow).toContain(expected("error"));
  expect(getComputedStyle(view.getByTestId("error-inset")).boxShadow).not.toContain(expected("hover"));
  await userEvent.hover(view.getByTestId("disabled-inset"), { force: true });
  expect(getComputedStyle(view.getByTestId("disabled-inset")).boxShadow).not.toContain(expected("hover"));
  await userEvent.click(view.getByTestId("normal-inset"));
  for (let index = 0; index < 3; index++) await commands.tabThroughControls();
  const error = view.getByTestId("error-inset");
  expect(document.activeElement).toBe(error);
  expect(error.matches(":focus-visible")).toBe(true);
  expect(getComputedStyle(error).outlineWidth).toBe("2px");
  expect(getComputedStyle(error).outlineOffset).toBe("3px");
  await expect.poll(() => getComputedStyle(error).boxShadow).toContain(expected("error"));
});

test("keeps component-local state overrides and surface shadows", () => {
  const view = render(<>
    <div style={{ "--accent-foreground": "rgb(123 45 67)" } as React.CSSProperties}>
      <span data-testid="local" className="text-on-state">Local state</span>
    </div>
    <span data-testid="surface" className="shadow-surface" />
    <span data-testid="expected-shadow" className="shadow-(--surface-shadow)" />
  </>);
  expect(getComputedStyle(view.getByTestId("local")).color).toBe("rgb(123, 45, 67)");
  expect(getComputedStyle(view.getByTestId("surface")).boxShadow).toBe(getComputedStyle(view.getByTestId("expected-shadow")).boxShadow);
});

test("adjusts accent text independently from action fills", () => {
  const view = render(<div style={{ "--primary": "rgb(12 34 56)", "--text-accent-color": "rgb(78 90 123)" } as React.CSSProperties}>
    <Button data-testid="fill">Fill</Button><Button variant="link" data-testid="text">Text</Button>
  </div>);
  expect(getComputedStyle(view.getByTestId("fill")).backgroundColor).toBe("rgb(12, 34, 56)");
  expect(getComputedStyle(view.getByTestId("text")).color).toBe("rgb(78, 90, 123)");
});

test("uses independent disabled text and icon colors for native and Base UI controls", () => {
  const view = render(<div style={{ "--text-disabled-color": "rgb(101 102 103)", "--icon-disabled-color": "rgb(141 142 143)" } as React.CSSProperties}>
    <Button disabled data-testid="button"><Check />Disabled</Button>
    <Input disabled data-testid="input" placeholder="Disabled input" />
    <Textarea disabled data-testid="textarea" />
    <Switch disabled aria-label="Disabled switch" data-testid="switch" />
    <Select disabled defaultValue="one" items={[{ value: "one", label: "One" }]}><SelectTrigger data-testid="select"><SelectValue /></SelectTrigger></Select>
    <Tabs defaultValue="one"><TabsList><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two" disabled data-testid="tab"><Check />Two</TabsTrigger></TabsList></Tabs>
    <Button aria-disabled="true" data-testid="aria"><Check />Unavailable</Button>
    <InputGroup><InputGroupInput disabled aria-label="Disabled group input" /><InputGroupButton data-testid="enabled-addon">Still available</InputGroupButton></InputGroup>
  </div>);
  for (const id of ["button", "input", "textarea", "switch", "select", "tab", "aria"]) {
    const element = view.getByTestId(id), style = getComputedStyle(element);
    expect(style.color, id).toBe("rgb(101, 102, 103)");
    expect(style.opacity, id).toBe("1");
    for (const icon of element.querySelectorAll("svg")) expect(getComputedStyle(icon).color, id).toBe("rgb(141, 142, 143)");
  }
  expect(getComputedStyle(view.getByTestId("switch").querySelector('[data-slot="switch-thumb"]')!).backgroundColor).toBe("rgb(141, 142, 143)");
  expect(getComputedStyle(view.getByTestId("enabled-addon")).color).not.toBe("rgb(101, 102, 103)");
});

test("shows one keyboard focus outline and propagates all four focus tokens", async () => {
  const view = render(<>
    <Button data-testid="button">Action</Button><Input aria-label="Input" data-testid="input" />
    <InputGroup data-testid="group"><InputGroupInput aria-label="Group input" data-testid="group-input" /><InputGroupButton data-testid="addon">Addon</InputGroupButton></InputGroup>
    <Switch aria-label="Switch" data-testid="switch" />
    <Select defaultValue="one" items={[{ value: "one", label: "One" }]}><SelectTrigger data-testid="select"><SelectValue /></SelectTrigger></Select>
    <Tabs defaultValue="one"><TabsList><TabsTrigger value="one" data-testid="tab">One</TabsTrigger></TabsList></Tabs>
  </>);
  const outline = (element: HTMLElement, width = "2px", offset = "3px", style = "solid") => {
    const computed = getComputedStyle(element);
    expect(computed.outlineWidth).toBe(width);
    expect(computed.outlineStyle).toBe(style);
    expect(computed.outlineOffset).toBe(offset);
  };
  expect(getComputedStyle(view.getByTestId("button")).outlineStyle).toBe("none");
  for (const id of ["button", "input", "group-input", "addon", "switch", "select", "tab"]) {
    await commands.tabThroughControls();
    expect(document.activeElement).toBe(view.getByTestId(id));
    outline(view.getByTestId(id === "group-input" ? "group" : id));
    if (id === "group-input") expect(getComputedStyle(view.getByTestId(id)).outlineStyle).toBe("none");
    if (id === "addon") expect(getComputedStyle(view.getByTestId("group")).outlineStyle).toBe("none");
  }
  root.style.setProperty("--focus-outline-width", "4px");
  root.style.setProperty("--focus-outline-offset", "5px");
  root.style.setProperty("--focus-outline-style", "dashed");
  root.style.setProperty("--focus-outline-color", "rgb(45 67 89)");
  outline(view.getByTestId("tab"), "4px", "5px", "dashed");
  expect(getComputedStyle(view.getByTestId("tab")).outlineColor).toBe("rgb(45, 67, 89)");
  await userEvent.click(view.getByTestId("button"));
  expect(getComputedStyle(view.getByTestId("button")).outlineStyle).toBe("none");
});

test("applies transient pressed overlays without replacing fills or selection", async () => {
  let calls = 0;
  const view = render(<>
    <Button data-testid="pressed" aria-pressed="true" onClick={() => { calls++; }}>Selected action</Button>
    <span data-testid="expected-pressed" style={{ backgroundImage: "linear-gradient(var(--pressed-bg), var(--pressed-bg))" }} />
  </>);
  const button = view.getByTestId("pressed");
  await userEvent.hover(button);
  const fill = getComputedStyle(button).backgroundColor;
  await commands.setPointerPressed(true);
  expect(button.matches(":active")).toBe(true);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(getComputedStyle(button).backgroundColor).toBe(fill);
  expect(getComputedStyle(button).backgroundImage).toBe(getComputedStyle(view.getByTestId("expected-pressed")).backgroundImage);
  expect(calls).toBe(0);
  await commands.setPointerPressed(false);
  expect(calls).toBe(1);
  expect(button.matches(":active")).toBe(false);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(getComputedStyle(button).backgroundImage).not.toBe(getComputedStyle(view.getByTestId("expected-pressed")).backgroundImage);
});


test("hover and portal elevation consume the shared tint and shadow color", async () => {
  root.classList.remove("dark");
  const view = render(<>
    <Button variant="outline" data-testid="tint">Hover</Button>
    <span data-testid="tint-role" style={{ backgroundColor: "color-mix(in oklab, rgb(12 34 56) 6%, transparent)" }} />
  </>);
  root.style.setProperty("--tint-hover-color", "rgb(12 34 56)");
  await userEvent.hover(view.getByTestId("tint"));
  await expect.poll(() => getComputedStyle(view.getByTestId("tint")).backgroundColor).toBe(getComputedStyle(view.getByTestId("tint-role")).backgroundColor);
  root.style.setProperty("--shadow-color", "rgb(12 34 56)");
  render(<Dialog defaultOpen><DialogContent><DialogTitle>Colorful elevation</DialogTitle></DialogContent></Dialog>);
  const shadow = getComputedStyle(document.querySelector('[data-slot="dialog-content"]')!).boxShadow;
  // Tailwind prepends transparent inset and ring layers before the elevation.
  const colors = shadow.match(/(?:rgba?|color)\([^)]*\)/g)!.slice(-3);
  expect(colors).toHaveLength(3);
  expect(colorPixel(colors[0])).toEqual(colorPixel("rgba(12, 34, 56, 0.05)"));
  expect(colorPixel(colors[1])).toEqual(colorPixel("rgba(12, 34, 56, 0.027)"));
});

for (const rootSize of [16, 20, 32]) test(`non-color bridge preserves the existing scale at ${rootSize}px`, () => {
  root.style.fontSize = `${rootSize}px`;
  root.style.setProperty("--radius", "10px");
  root.style.setProperty("--border-width", "3px");
  const view = render(<>
    <div data-testid="spacing" className="p-4 gap-2" />
    <div data-testid="small" className="text-xs font-bold" />
    <div data-testid="large" className="text-4xl" />
    <div data-testid="display" className="text-5xl" />
    <div data-testid="mono" className="font-mono" />
    <div data-testid="shape-xs" className="rounded-xs" />
    <div data-testid="shape-md" className="rounded-md" />
    <div data-testid="shape-none" className="rounded-none" />
    <div data-testid="shape-full" className="rounded-full" />
    <div data-testid="colors" className="transition-colors" />
    <div data-testid="opacity" className="transition-opacity" />
    <div data-testid="shadow" className="transition-shadow" />
    <div data-testid="transform" className="transition-transform" />
    <div data-testid="ease" className="transition-opacity ease-out" />
    <span data-testid="property-border" className="note-property-inline" />
    <div className="rich-block-menu"><div role="separator" data-testid="menu-border" /></div>
  </>);
  const style = (id: string) => getComputedStyle(view.getByTestId(id));
  expect(style("spacing").paddingTop).toBe(`${rootSize}px`);
  expect(style("spacing").gap).toBe(`${rootSize / 2}px`);
  expect(style("small").fontSize).toBe(`${rootSize * .75}px`);
  expect(style("small").fontWeight).toBe("600");
  expect(style("large").fontSize).toBe(`${rootSize * 2.25}px`);
  expect(style("display").fontSize).toBe(`${rootSize * 3}px`);
  expect(style("mono").fontFamily.replaceAll('"', "")).toBe("ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace");
  expect(style("shape-xs").borderRadius).toBe(`${rootSize / 8}px`);
  expect(style("shape-md").borderRadius).toBe("8px");
  expect(style("shape-none").borderRadius).toBe("0px");
  expect(parseFloat(style("shape-full").borderRadius)).toBeGreaterThan(9999);
  expect(style("colors").transitionProperty).toContain("outline-color");
  expect(style("transform").transitionProperty).toBe("transform, translate, scale, rotate");
  expect(style("opacity").transitionProperty).toBe("opacity");
  expect(style("shadow").transitionProperty).toBe("box-shadow");
  expect(style("opacity").transitionDuration).toBe("0.15s");
  expect(style("opacity").transitionTimingFunction).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
  expect(style("ease").transitionTimingFunction).toBe("cubic-bezier(0, 0, 0.2, 1)");
  expect(style("property-border").outlineWidth).toBe("3px");
  expect(style("menu-border").height).toBe("3px");
});

test("skeleton fill can change independently from persistent selection", () => {
  const view = render(<><Skeleton data-testid="skeleton" /><div className="bg-state" data-testid="selection" /></>);
  const selected = getComputedStyle(view.getByTestId("selection")).backgroundColor;
  expect(getComputedStyle(view.getByTestId("skeleton")).backgroundColor).toBe(selected);
  root.style.setProperty("--skeleton-bg", "rgb(12 34 56)");
  expect(getComputedStyle(view.getByTestId("skeleton")).backgroundColor).toBe("rgb(12, 34, 56)");
  expect(getComputedStyle(view.getByTestId("selection")).backgroundColor).toBe(selected);
});
