import { createStateFixture } from "../../ui-state-fixtures/state-fixture";
import { getScenario } from "./scenarios";
export type { Draft, DraftList, DraftIssue, Environment, RegisteredVault, SelectVaultResult, Attachment, StorageMode } from "../../src/bridge";
export { errorMessage } from "../../src/error-messages";

const params = new URLSearchParams(location.search);
export const mock = createStateFixture(getScenario(params.get("scenario")).id);
const readDelay = Math.max(0, Math.min(5000, Number(params.get("delay")) || 0));
export const request: typeof mock.request = async (operation, values) => {
  if (readDelay && /^(get|list|query|resolve)/.test(operation)) await new Promise(resolve => setTimeout(resolve, readDelay));
  return mock.request(operation, values);
};
export const isBrowserVault = mock.browser;
export const isLocalWeb = !isBrowserVault;
export const isConnectedClient = true;
export const isNative = false;
export function reconnectVault() { /* No native transport is reachable in preview. */ }
