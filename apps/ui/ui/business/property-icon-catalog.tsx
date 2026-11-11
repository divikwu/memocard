import { Suspense, type ReactNode } from "react";
import { recoverableLazy } from "../components/recoverable-lazy";
import { SidebarIcon } from "./sidebar-icons";

const CatalogIcon = recoverableLazy(
  () => import("./property-icon-options").then(module => ({ default: module.CatalogIcon })),
  "自定义图标",
  ({ fallback }) => fallback,
);

export function PropertyIconGlyph({ value, fallback }: { value?: string; fallback: ReactNode }) {
  if (value?.startsWith("emoji:")) return <span aria-hidden="true" className="note-property-file-emoji">{value.slice(6)}</span>;
  if (!value?.startsWith("icon:")) return fallback;
  return <Suspense fallback={fallback}><CatalogIcon value={value} fallback={fallback} /></Suspense>;
}

export function TagIcon({ value, fallback = <SidebarIcon name="hash" /> }: { value?: string; fallback?: ReactNode }) {
  if (!value) return fallback;
  if (!value.startsWith("icon:")) return <span className="ui-sidebar-emoji" aria-hidden="true">{value}</span>;
  return <Suspense fallback={fallback}><CatalogIcon value={value} fallback={fallback} className="size-4 shrink-0" /></Suspense>;
}
