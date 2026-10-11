/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

const VaultContext = createContext<string | null>(null);
export function useTagColorVault() { return useContext(VaultContext); }
export function TagColorProvider({ vaultId, children }: { vaultId?: string | null; children: ReactNode }) {
  return <VaultContext.Provider value={vaultId || null}>{children}</VaultContext.Provider>;
}
