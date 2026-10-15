import { createPreviewMock } from './mock';
export type {Draft,DraftList,DraftIssue,Environment,RegisteredVault,SelectVaultResult,Attachment,StorageMode} from '../src/bridge';
export const mock = createPreviewMock(new URLSearchParams(location.search).get('scenario') ?? 'disconnected');
const readDelay = Math.max(0, Math.min(5000, Number(new URLSearchParams(location.search).get('delay')) || 0));
export const request: typeof mock.request = async (operation, params) => {
  if (readDelay && /^(get|list|query|resolve)/.test(operation)) await new Promise(resolve => setTimeout(resolve, readDelay));
  return mock.request(operation, params);
};
export const isBrowserVault = mock.browser;
export const isLocalWeb = !isBrowserVault;
export const isConnectedClient = true;
export const isNative = false;
export { errorMessage } from '../src/error-messages';
export function reconnectVault() { /* Isolated preview never navigates to a native service. */ }
