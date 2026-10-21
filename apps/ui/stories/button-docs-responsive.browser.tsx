import { afterEach, expect, test } from "vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { buttonDocsStories, renderButtonDocs } from "../.storybook/button-docs.fixture";
import { StorybookTheme } from "../.storybook/preview";
import { colorPixel, contrastRatio } from "./foundation-color-contrast";

let container: HTMLElement;
let unmountDocs: (() => void) | undefined;
afterEach(() => { unmountDocs?.(); unmountDocs = undefined; cleanup(); container?.remove(); });

test.each(["light", "dark"])("standalone Docs examples keep system gutters on the narrow %s canvas", async theme => {
  const width = window.innerWidth;
  for (const name of ["Overview", "Examples", "Properties", "Anatomy", "States", "Actions"] as const) {
    const Story = buttonDocsStories[name];
    const rendered = render(<StorybookTheme globals={{ theme }}><Story /></StorybookTheme>);
    const wrapper = rendered.container.querySelector<HTMLElement>(".component-docs-standalone")!;
    expect(getComputedStyle(wrapper).paddingInlineStart).toBe("16px");
    expect(getComputedStyle(wrapper).paddingInlineEnd).toBe("16px");
    const bounds = wrapper.getBoundingClientRect();
    const content = wrapper.firstElementChild!.getBoundingClientRect();
    expect(content.left - bounds.left).toBe(16);
    expect(bounds.right - content.right).toBe(16);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
    expect(within(rendered.container).queryByRole("link", { name: "在 Canvas 中打开" })).not.toBeInTheDocument();
    rendered.unmount();
  }
});

// Real DocsRenderer and all nested stories at the browser's actual viewport.
// The shared fixture substitutes only the Storybook iframe loading boundary.
test.each(["light", "dark"])("all three Button Docs pages fit the narrow %s canvas", async theme => {
  const width = window.innerWidth;
  expect([320, 390]).toContain(width);
  container = document.createElement("main");
  document.body.append(container);
  const rendered = await renderButtonDocs(container);
  unmountDocs = rendered;
  rendered.updateGlobals({ theme });
  expect(document.documentElement).toHaveClass(theme);
  const docs = within(container);
  const tabs = docs.getByRole("tablist", { name: "Button 文档" });
  expect(getComputedStyle(tabs).columnGap).toBe("12px");
  expect(getComputedStyle(tabs).rowGap).toBe("4px");
  expect(getComputedStyle(tabs).padding).toBe("3px");
  expect(getComputedStyle(tabs).height).toBe("32px");
  for (const tab of within(tabs).getAllByRole("tab")) {
    expect(getComputedStyle(tab).fontWeight).toBe("500");
    expect(getComputedStyle(tab).paddingInlineStart).toBe("2px");
    expect(getComputedStyle(tab).paddingInlineEnd).toBe("2px");
    expect(getComputedStyle(tab).paddingBlockStart).toBe("2px");
  }

  const expectPageFits = () => {
    expect(document.documentElement.scrollWidth, JSON.stringify([...container.querySelectorAll<HTMLElement>(".sbdocs-wrapper, .sbdocs-content, .component-docs, .component-docs-panel, .component-docs-table-wrap")].map(element => ({
      class: element.className, width: element.getBoundingClientRect().width, minWidth: getComputedStyle(element).minWidth,
    })))).toBeLessThanOrEqual(width + 1);
    expect(container.querySelector(".component-docs")!.getBoundingClientRect().right).toBeLessThanOrEqual(width + 1);
  };
  const expectFrameFits = (frame: HTMLIFrameElement) => {
    const content = frame.contentDocument!;
    expect(content.getElementById("storybook-root")).not.toBeNull();
    expect(content.documentElement.scrollWidth).toBeLessThanOrEqual(frame.clientWidth + 1);
    expect(content.documentElement.scrollHeight).toBeLessThanOrEqual(frame.clientHeight + 1);
    expect(frame.getBoundingClientRect().right).toBeLessThanOrEqual(width + 1);
  };
  const expectVisibleFramesFit = async (name = "Overview") => {
    const panel = docs.getByRole("tabpanel", { name });
    await Promise.all([document.fonts.ready, ...[...panel.querySelectorAll("iframe")].map(frame => frame.contentDocument!.fonts.ready)]);
    await waitFor(() => {
      expectPageFits();
      for (const frame of panel.querySelectorAll("iframe")) expectFrameFits(frame);
    });
  };

  await expectVisibleFramesFit();
  const practices = docs.getByRole("table", { name: "最佳实践" });
  expect(docs.queryByRole("heading", { name: "使用建议" })).not.toBeInTheDocument();
  expect(within(practices).getAllByRole("rowheader", { name: "推荐" })).toHaveLength(5);
  expect(within(practices).getAllByRole("rowheader", { name: "避免" })).toHaveLength(3);
  expect(practices).toHaveTextContent('variant="link"');
  const practicesWrap = practices.parentElement!;
  const heading = docs.getByRole("heading", { name: "最佳实践" });
  expect(getComputedStyle(heading).marginTop).toBe("40px");
  expect(practicesWrap.getBoundingClientRect().top - heading.getBoundingClientRect().bottom).toBe(16);
  expect(docs.getByRole("heading", { name: "示例" }).getBoundingClientRect().top - practicesWrap.getBoundingClientRect().bottom).toBe(40);
  expect(practicesWrap.scrollWidth).toBeLessThanOrEqual(practicesWrap.clientWidth + 1);
  expect(getComputedStyle(practicesWrap).borderTopWidth).toBe("1px");
  expect(getComputedStyle(practicesWrap).borderRadius).toBe(getComputedStyle(container.querySelector(".component-docs-example")!).borderRadius);
  expect(getComputedStyle(practices).color).toBe(getComputedStyle(container.querySelector(".sbdocs-title")!).color);
  for (const cell of practices.querySelectorAll("td")) {
    expect(getComputedStyle(cell).fontSize).toBe("14px");
    expect(getComputedStyle(cell).fontFamily).toBe(getComputedStyle(container.querySelector("p")!).fontFamily);
    expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth + 1);
  }
  for (const badge of practices.querySelectorAll('[data-slot="badge"]')) {
    expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(badge.closest("th")!.getBoundingClientRect().right);
    expect(getComputedStyle(badge).fontSize).toBe("12px");
  }
  const hero = container.querySelector<HTMLIFrameElement>('iframe[title="Overview"]')!;
  const buttons = within(hero.contentDocument!.body).getAllByRole("button");
  expect(buttons).toHaveLength(6);
  for (const button of buttons) {
    const rect = button.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(hero.clientWidth);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(hero.clientHeight);
  }
  const examples = container.querySelector<HTMLIFrameElement>('iframe[title="Examples"]')!;
  const icon = within(examples.contentDocument!.body).getByRole("region", { name: "Button — Icon" });
  const descriptionHeight = examples.clientHeight;
  const codeToggle = within(icon).getByRole("button", { name: "切换预览与代码" });
  expect(icon.querySelector(".component-docs-preview-title")).toHaveTextContent("Button — Icon");
  await userEvent.click(codeToggle);
  expect(within(icon).getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
  await waitFor(() => expect(examples.clientHeight).toBeGreaterThan(descriptionHeight));
  await expectVisibleFramesFit();
  await userEvent.click(within(icon).getByRole("tab", { name: "描述" }));
  expect(codeToggle).toHaveAttribute("aria-pressed", "false");
  await waitFor(() => expect(examples.clientHeight).toBe(descriptionHeight));

  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  const properties = docs.getByRole("tabpanel", { name: "Properties" }).querySelector("iframe")!;
  const propertiesBody = properties.contentDocument!.body;
  const controls = within(propertiesBody);
  await waitFor(() => expect(propertiesBody.ownerDocument.documentElement).toHaveClass(theme));
  expect(propertiesBody.querySelector(".component-docs-preview-title")).toHaveTextContent("Button");
  const children = await controls.findByLabelText("children");
  await userEvent.clear(children);
  await userEvent.type(children, "窄屏参数");
  await userEvent.click(controls.getByRole("button", { name: "窄屏参数" }));
  await userEvent.click(controls.getByRole("combobox", { name: "variant" }));
  // Base UI portals belong to the outer fixture document, as in the desktop regression.
  await userEvent.click(await within(document.body).findByRole("option", { name: "outline" }));
  await userEvent.click(controls.getByRole("switch", { name: "disabled" }));
  expect(controls.getByRole("button", { name: "窄屏参数" })).toBeDisabled();
  await userEvent.click(controls.getByRole("button", { name: "切换预览与代码" }));
  const source = controls.getByRole("region", { name: "Button 代码" }).querySelector(".component-docs-source")!;
  expect.soft(getComputedStyle(source).borderTopWidth).toBe("0px");
  expect.soft(getComputedStyle(source).borderRadius).toBe("0px");
  const background = colorPixel(getComputedStyle(source).backgroundColor);
  const tokenColors = new Set([...source.querySelectorAll("pre .token")].map(token => getComputedStyle(token).color));
  expect(tokenColors.size).toBeGreaterThan(0);
  for (const color of tokenColors) expect.soft(contrastRatio(colorPixel(color), background), `${theme} syntax color ${color}`).toBeGreaterThanOrEqual(4.5);
  await waitFor(() => {
    expectPageFits();
    expectFrameFits(properties);
    const table = propertiesBody.querySelector(".component-docs-properties-table-wrap")!;
    expect(table.clientWidth).toBeLessThanOrEqual(properties.clientWidth);
    expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
    expect(getComputedStyle(table).borderTopWidth).toBe("1px");
    expect(getComputedStyle(table).borderRadius).toBe(getComputedStyle(propertiesBody.querySelector(".component-docs-properties-preview")!).borderRadius);
    expect(getComputedStyle(table).borderTopColor).toBe(getComputedStyle(propertiesBody.querySelector(".component-docs-properties-preview")!).borderTopColor);
    expect(propertiesBody.querySelector(".component-docs-properties-caption")!.getBoundingClientRect().bottom).toBeLessThanOrEqual(table.getBoundingClientRect().top);
    for (const control of table.querySelectorAll('[data-slot="input"], button[role="combobox"]')) {
      expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);
    }
  });

  await userEvent.click(docs.getByRole("tab", { name: "Accessibility" }));
  await expectVisibleFramesFit("Accessibility");
  const accessibility = container.querySelector(".component-docs-markdown")!;
  expect(accessibility.querySelectorAll("table")).toHaveLength(2);
  for (const table of accessibility.querySelectorAll("table")) {
    const scroll = table.parentElement!;
    expect(scroll.getBoundingClientRect().right).toBeLessThanOrEqual(width);
    expect(scroll.getAttribute("role")).toBe("region");
    expect(scroll.tabIndex).toBe(0);
    expect(getComputedStyle(scroll).overflowX).toBe("auto");
    expect.soft(getComputedStyle(scroll).borderTopWidth).toBe("1px");
    expect.soft(getComputedStyle(scroll).borderRadius).not.toBe("0px");
    expect.soft(getComputedStyle(table).borderTopWidth).toBe("0px");
    expect.soft(getComputedStyle(table).borderRadius).toBe("0px");
    if (table.tHead!.rows[0].cells.length >= 4) {
      expect.soft(table.getBoundingClientRect().width).toBeGreaterThanOrEqual(672);
      expect.soft(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
      const cells = table.tHead!.rows[0].cells;
      expect.soft(cells[0].getBoundingClientRect().width - 32).toBeGreaterThanOrEqual(56);
      expect.soft(cells[3].getBoundingClientRect().width - 32).toBeGreaterThanOrEqual(160);
      const frame = scroll.getBoundingClientRect();
      scroll.scrollLeft = scroll.scrollWidth;
      expect.soft(scroll.scrollLeft).toBeGreaterThan(0);
      expect.soft(scroll.getBoundingClientRect().right).toBe(frame.right);
    } else {
      expect.soft(table.getBoundingClientRect().width).toBeLessThanOrEqual(scroll.clientWidth + 1);
    }
  }
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  rendered.updateGlobals({ theme: theme === "light" ? "dark" : "light" });
  await rendered.rerender();
  expect(docs.getByRole("tab", { name: "Properties" })).toHaveAttribute("aria-selected", "true");
  expect(docs.getByRole("tabpanel", { name: "Properties" }).querySelector("iframe")).toBe(properties);
  expect(children).toHaveValue("窄屏参数");
  expect(controls.getByText("演示点击：1 次")).toBeVisible();
  expect(controls.getByRole("button", { name: "切换预览与代码" })).toHaveAttribute("aria-pressed", "true");
  expect(propertiesBody.querySelectorAll(".component-docs-properties")).toHaveLength(1);
  const code = controls.getByRole("region", { name: "Button 代码" }).querySelector("pre")!;
  expect(code).toHaveTextContent('variant="outline"');
  expect(code).toHaveTextContent("disabled");
  await userEvent.click(controls.getByRole("button", { name: "Reset" }));
  expect(children).toHaveValue("保存");
  expect(controls.getByText("演示点击：0 次")).toBeVisible();
  expect(code).toHaveTextContent('variant="default"');
  expect(controls.getByRole("button", { name: "切换预览与代码" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(controls.getByRole("button", { name: "切换预览与代码" }));
  expect(controls.getByRole("button", { name: "保存" })).toBeEnabled();
  expectPageFits();
});
