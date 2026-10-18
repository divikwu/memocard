// Runtime imports are replaced before the real bridge can initialize or connect.
export type { RegisteredVault, Environment, Draft, DraftList, DraftIssue, Attachment, StorageMode } from "../src/bridge";
export const isNative = false;
export const isBrowserVault = false;
export const isLocalWeb = false;
export const isConnectedClient = false;
export { errorMessage } from "../src/error-messages";
export async function request<T>(operation: string): Promise<T> {
  throw new Error(`Storybook fixture has no data operation: ${operation}`);
}
export function reconnectVault() { /* Preview cannot open the user's notebook. */ }
