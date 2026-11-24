import { isLocalWeb } from "../../src/client-mode";

export async function localWebEntryMissing() {
  if (!isLocalWeb) return false;
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
