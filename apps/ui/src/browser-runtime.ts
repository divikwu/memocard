import { isBrowserVault } from './client-mode';

// Finish loading before the browser UI mounts, preserving synchronous picker activation.
// Native and local-web clients do not need the directory-backed storage implementation.
const runtime = isBrowserVault ? await import('./browser-vault') : undefined;

export const browserTransport = runtime?.browserTransport;
export const getBrowserVaultBinding = () => runtime?.getBrowserVaultBinding() ?? null;
export const readBrowserAsset = (path: string, expectedBinding?: string) => runtime!.readBrowserAsset(path, expectedBinding);
