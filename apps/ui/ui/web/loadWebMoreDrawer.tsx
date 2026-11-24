import type { ComponentProps, ComponentType } from "react";
import { localWebEntryMissing } from "./local-web-entry-missing";
import { Button } from "../components/button";
import type WebMoreDrawer from "./WebMoreDrawer";

type DrawerProps = ComponentProps<typeof WebMoreDrawer>;

export function loadWebMoreDrawer(): Promise<{ default: ComponentType<DrawerProps> }> {
  return import("./WebMoreDrawer").catch(async error => {
    if (!await localWebEntryMissing()) throw error;
    return { default: RefreshRequired };
  });
}

function RefreshRequired({ open }: DrawerProps) {
  if (!open) return null;
  return <section role="alert" className="space-y-3 p-4">
    <p>本机服务已更新，请刷新页面后继续。</p>
    <Button variant="outline" onClick={() => window.location.reload()}>刷新页面</Button>
  </section>;
}
