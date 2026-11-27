import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appearanceCatalog, resolveAppearance } from "./catalog";
import { sidebarLayout } from "../layouts/sidebar";
import type { AppearanceCatalog, AppearanceResolution, LayoutAdapter } from "./contracts";

const CatalogContext = createContext<AppearanceCatalog>(appearanceCatalog);
export function AppearanceCatalogProvider({ catalog, children }: { catalog: AppearanceCatalog; children: ReactNode }) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}
export const useAppearanceCatalog = () => useContext(CatalogContext);

type AppliedAppearance = AppearanceResolution & { adapter: LayoutAdapter };
export type AppearanceRuntime = {
  applied: AppliedAppearance;
  pending: boolean;
  error: boolean;
  select: (id: string) => void;
  retry: () => void;
};
const RuntimeContext = createContext<AppearanceRuntime | null>(null);
export const AppearanceRuntimeProvider = RuntimeContext.Provider;
export const useWorkspaceAppearance = () => useContext(RuntimeContext);

function initialAppearance(catalog: AppearanceCatalog, requested: string, mobile: boolean): AppliedAppearance {
  const resolution = resolveAppearance(catalog, requested, mobile);
  const { layoutId } = resolution;
  const adapter = layoutId === "drawer" || layoutId === "sidebar" ? sidebarLayout : {};
  return { ...resolution, adapter };
}

function fallbackAppearance(mobile: boolean): AppliedAppearance {
  return { themeId: "classic", layoutId: mobile ? "drawer" : "sidebar", themeFallback: null, layoutFallback: null, adapter: sidebarLayout };
}

export function useAppearanceRuntime({ requested, revision, mobile, enabled, commit }: {
  requested: string;
  revision?: number;
  mobile: boolean;
  enabled: boolean;
  commit: (id: string) => void;
}): AppearanceRuntime {
  const catalog = useAppearanceCatalog();
  const [intent, setIntent] = useState({ id: requested, persist: false });
  const [applied, setApplied] = useState<AppliedAppearance | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const latestApplied = useRef(applied);
  useLayoutEffect(() => { latestApplied.current = applied; });
  const latestCommit = useRef(commit);
  useLayoutEffect(() => { latestCommit.current = commit; });
  useLayoutEffect(() => { setIntent({ id: requested, persist: false }); }, [requested, revision]);
  const resources = useMemo(() => ({ catalog, cache: new Map<() => Promise<unknown>, Promise<unknown>>() }), [catalog]);
  useEffect(() => {
    let current = true;
    if (!enabled) return;
    const requestedResolution = resolveAppearance(catalog, intent.id, mobile);
    const resolution = requestedResolution.themeFallback ? { ...resolveAppearance(catalog, latestApplied.current?.themeId ?? "classic", mobile), themeFallback: requestedResolution.themeFallback } : requestedResolution;
    const load = <T,>(run: () => Promise<T>): Promise<T> => {
      if (!resources.cache.has(run)) {
        const request = Promise.resolve().then(run).catch(cause => { resources.cache.delete(run); throw cause; });
        resources.cache.set(run, request);
      }
      return resources.cache.get(run) as Promise<T>;
    };
    // Viewport adaptation belongs to the usable theme, even while another theme
    // is still loading. A failed target must not strand a desktop-only layout.
    const previous = latestApplied.current;
    const usable = previous ? resolveAppearance(catalog, previous.themeId, mobile) : resolution;
    if (previous && catalog.layouts[previous.layoutId]?.viewport !== (mobile ? "mobile" : "desktop")) {
      const adapt = (adapter: LayoutAdapter, layout = usable) => {
        if (current) setApplied(value => value?.themeId === previous.themeId && value.layoutId === previous.layoutId
          ? { ...value, layoutId: layout.layoutId, layoutFallback: layout.layoutFallback, adapter } : value);
      };
      void load(catalog.layouts[usable.layoutId].load).then(adapter => {
        if (!adapter.TopNavigation && !adapter.SideNavigation) throw new Error();
        adapt(adapter);
      }).catch(() => adapt(sidebarLayout, { ...usable, layoutId: mobile ? "drawer" : "sidebar", layoutFallback: "unsupported-viewport" }));
    }
    setPending(true); setError(false);
    void Promise.all([
      load(catalog.themes[resolution.themeId].loadStyles),
      load(catalog.layouts[resolution.layoutId].load),
    ]).then(([, adapter]) => {
      if (!adapter.TopNavigation && !adapter.SideNavigation) throw new Error();
      if (!current) return;
      setApplied({ ...resolution, adapter }); setPending(false);
      if (intent.persist && !resolution.themeFallback) latestCommit.current(intent.id);
    }).catch(() => {
      if (!current) return;
      setApplied(value => value ?? fallbackAppearance(mobile));
      setPending(false); setError(true);
    });
    return () => { current = false; };
  }, [catalog, intent, mobile, enabled, resources]);
  const fitsViewport = applied && catalog.layouts[applied.layoutId]?.viewport === (mobile ? "mobile" : "desktop");
  const display = enabled
    ? fitsViewport ? applied : initialAppearance(catalog, applied?.themeId ?? requested, mobile)
    : fallbackAppearance(mobile);
  return { applied: display, pending, error,
    select: id => setIntent({ id, persist: true }), retry: () => setIntent(value => ({ ...value })) };
}
