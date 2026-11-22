/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

const VaultContext = createContext<string | null>(null);
const BindingContext = createContext<string | undefined>(undefined);
export function useTagColorVault() { return useContext(VaultContext); }
export function useTagVaultBinding() { return useContext(BindingContext); }
export function TagColorProvider({ vaultId, vaultBinding, children }: { vaultId?: string | null; vaultBinding?: string; children: ReactNode }) {
  return <VaultContext.Provider value={vaultId || null}><BindingContext.Provider value={vaultBinding}>{children}</BindingContext.Provider></VaultContext.Provider>;
}
