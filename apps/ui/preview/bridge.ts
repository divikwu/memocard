import { createPreviewMock } from './mock';
export type {Draft,DraftList,DraftIssue,Environment,RegisteredVault,SelectVaultResult,Attachment,StorageMode} from '../src/bridge';
export const mock = createPreviewMock(new URLSearchParams(location.search).get('scenario') ?? 'disconnected');
export const request = mock.request;
export const isBrowserVault = mock.browser;
export const isLocalWeb = !isBrowserVault;
export const isConnectedClient = true;
export const isNative = false;
export { errorMessage } from '../src/error-messages';
export function reconnectVault() { /* Isolated preview never navigates to a native service. */ }
