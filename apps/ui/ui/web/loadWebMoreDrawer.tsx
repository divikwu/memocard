import type { ComponentProps, ComponentType } from "react";
import { isLocalWeb } from "../../src/client-mode";
import { Button } from "../components/button";
import type WebMoreDrawer from "./WebMoreDrawer";

type DrawerProps = ComponentProps<typeof WebMoreDrawer>;

export function loadWebMoreDrawer(): Promise<{ default: ComponentType<DrawerProps> }> {
  return import("./WebMoreDrawer").catch(async error => {
    if (!isLocalWeb || !await localWebEntryMissing()) throw error;
    return { default: RefreshRequired };
  });
}

async function localWebEntryMissing() {
  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
  if (!entry) return false;
  try {
    // Hashed entry files are cached as immutable. Ask the current service.
    const response = await fetch(entry, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    void response.body?.cancel().catch(() => undefined);
    return response.status === 404;
  } catch {
    return false;
  }
}

function RefreshRequired({ open }: DrawerProps) {
  if (!open) return null;
  return <section role="alert" className="space-y-3 p-4">
    <p>本机服务已更新，请刷新页面后继续。</p>
    <Button variant="outline" onClick={() => window.location.reload()}>刷新页面</Button>
  </section>;
}
