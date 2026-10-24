// Runtime imports are replaced before the real bridge can initialize or connect.
export type { RegisteredVault, Environment, Draft, DraftList, DraftIssue, Attachment, StorageMode } from "../src/bridge";
export const isNative = false;
export let isBrowserVault = false;
export let isLocalWeb = false;
export let isConnectedClient = false;
export { errorMessage } from "../src/error-messages";
type RequestHandler = (operation: string, params: Record<string, unknown>) => unknown | Promise<unknown>;
let requestHandler: RequestHandler | undefined;
let browserAssets: { binding: string; values: Record<string, Blob> } | undefined;
let assetSequence = 0;
type StorybookClientMode = "browser" | "local-web";
let clientModes: { mode: StorybookClientMode }[] = [];

function updateClientMode() {
  const mode = clientModes.at(-1)?.mode;
  isBrowserVault = mode === "browser" || (!mode && Boolean(browserAssets));
  isLocalWeb = mode === "local-web";
}

export function setStorybookClientMode(mode: StorybookClientMode): () => void {
  const scope = { mode };
  clientModes.push(scope);
  updateClientMode();
  return () => { clientModes = clientModes.filter(value => value !== scope); updateClientMode(); };
}

export function setStorybookRequestHandler(handler: RequestHandler): () => void {
  requestHandler = handler;
  isConnectedClient = true;
  return () => { if (requestHandler === handler) { requestHandler = undefined; isConnectedClient = false; } };
}

export function setStorybookBrowserAssets(values: Record<string, Blob>): () => void {
  const fixture = { binding: `storybook-assets-${++assetSequence}`, values };
  browserAssets = fixture;
  updateClientMode();
  return () => {
    if (browserAssets !== fixture) return;
    browserAssets = undefined;
    updateClientMode();
  };
}

export function resetStorybookBridge(): void {
  requestHandler = undefined;
  isConnectedClient = false;
  browserAssets = undefined;
  clientModes = [];
  updateClientMode();
}

export const getBrowserVaultBinding = () => browserAssets?.binding ?? null;
export async function readBrowserAsset(path: string, expectedBinding?: string): Promise<Blob> {
  if (!browserAssets || (expectedBinding !== undefined && expectedBinding !== browserAssets.binding)
    || !Object.hasOwn(browserAssets.values, path)) {
    throw new Error(`Storybook fixture has no asset: ${path}`);
  }
  return browserAssets.values[path];
}

export async function request<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!requestHandler) throw new Error(`Storybook fixture has no data operation: ${operation}`);
  return await requestHandler(operation, params) as T;
}
export function reconnectVault() { /* Preview cannot open the user's notebook. */ }
