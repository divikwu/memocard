import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { ThemeProvider } from "../src/features/theme/ThemeProvider";
import { SidebarExample } from "./sidebar.example";
import { sidebarArgs } from "./sidebar.fixtures";
import "../.storybook/preview.css";

afterEach(cleanup);

async function resize(width: number) {
  await page.viewport(width, 900);
  expect(window.innerWidth).toBe(width);
  expect(window.innerHeight).toBe(900);
  expect(window.matchMedia("(max-width: 767px)").matches).toBe(width < 768);
}

async function expectNotesMetrics(height: number, fontSize: number) {
  const notes = page.getByRole("button", { name: "所有笔记", exact: true });
  await expect.element(notes).toBeVisible();
  await expect.poll(() => {
    const button = notes.element();
    return { height: button.getBoundingClientRect().height, fontSize: getComputedStyle(button).fontSize };
  }).toEqual({ height, fontSize: `${fontSize}px` });
}

test("real 767 ↔ 768 viewport changes preserve desktop state and close the mobile drawer", async () => {
  const args = sidebarArgs({ vaultId: "storybook-breakpoints" });
  await resize(768);
  render(<ThemeProvider><SidebarExample {...args} /></ThemeProvider>);
  const main = page.getByRole("main");
  await expectNotesMetrics(32, 14);
  await main.getByRole("button", { name: "收起侧栏", exact: true }).click();
  await expect.element(main.getByRole("button", { name: "展开侧栏", exact: true })).toBeVisible();

  await resize(767);
  const trigger = main.getByRole("button", { name: "打开导航", exact: true });
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await trigger.click();
  await expectNotesMetrics(48, 16);
  await page.getByRole("button", { name: "展开或收起快捷筛选", exact: true }).click();
  await expect.element(page.getByRole("button", { name: "有图片", exact: true })).toBeVisible();
  expect(args.onNavigate).not.toHaveBeenCalled();

  await resize(768);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await expect.element(main.getByRole("button", { name: "展开侧栏", exact: true })).toBeVisible();
  await main.getByRole("button", { name: "展开侧栏", exact: true }).click();
  await expectNotesMetrics(32, 14);

  await resize(767);
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await trigger.click();
  await expectNotesMetrics(48, 16);
  await page.getByRole("button", { name: "所有笔记", exact: true }).click();
  expect(args.onNavigate).toHaveBeenLastCalledWith("notes", null);
});
