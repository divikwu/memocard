import { Suspense } from "react";
import { recoverableLazy } from "../components/recoverable-lazy";
import { cn } from "../lib/utils";
import type { EmptyIllustrationKind } from "./EmptyIllustrationArt";

// Decorative artwork must not delay the list or hide the state message if loading fails.
const Artwork = recoverableLazy(() => import("./EmptyIllustrationArt"), "状态插画", () => null);

export function EmptyIllustration({ kind, compact = false }: { kind: EmptyIllustrationKind; compact?: boolean }) {
  return <div className={cn("mb-2 aspect-[5/4] max-w-full shrink-0", compact ? "w-48" : "w-56")}>
    <Suspense fallback={null}><Artwork kind={kind} /></Suspense>
  </div>;
}
