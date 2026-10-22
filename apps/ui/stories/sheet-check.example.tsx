import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../src/components/ui/sheet";

export function DrawerCheck() {
  return <main className="max-w-4xl space-y-6 bg-background p-6 text-foreground">
    <h1 className="text-2xl font-semibold">浮层检查</h1>
    <Sheet>
      <SheetTrigger render={<Button variant="outline">打开抽屉</Button>} />
      <SheetContent>
        <SheetHeader><SheetTitle>抽屉检查</SheetTitle><SheetDescription>按 Esc 或关闭按钮返回。</SheetDescription></SheetHeader>
      </SheetContent>
    </Sheet>
  </main>;
}

export async function inspectDrawer({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement), page = within(canvasElement.ownerDocument.body);
  await expect(canvas.getAllByRole("heading")).toHaveLength(1);
  await expect(canvas.getByRole("heading", { name: "浮层检查" })).toBeVisible();
  await expect(canvas.queryByTestId("sidebar-icon")).toBeNull();
  await expect(canvas.queryByLabelText("浮层阴影样本")).toBeNull();
  await expect(canvas.queryByLabelText("当前动效媒体偏好")).toBeNull();
  await expect(canvas.queryByLabelText("动效抽屉状态")).toBeNull();
  const trigger = canvas.getByRole("button", { name: "打开抽屉" });
  await expect(canvas.getAllByRole("button")).toHaveLength(1);
  await userEvent.tab();
  await expect(trigger).toHaveFocus();
  await expect(getComputedStyle(trigger).boxShadow).not.toBe("none");
  for (const escape of [true, false]) {
    await userEvent.keyboard("{Enter}");
    const sheet = await page.findByRole("dialog", { name: "抽屉检查" });
    await expect(sheet).toHaveAttribute("data-slot", "sheet-content");
    const close = within(sheet).getByRole("button", { name: "关闭" });
    await waitFor(() => expect(close).toHaveFocus());
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-slot="sheet-overlay"]')).toBeVisible());
    if (escape) await userEvent.keyboard("{Escape}");
    else await userEvent.click(close);
    await waitFor(() => expect(sheet).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  }
}
