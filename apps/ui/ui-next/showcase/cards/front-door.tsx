// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Badge } from "@ui-next/components/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ui-next/components/card"
import { IconPlaceholder } from "@ui-next/showcase-icons"

export function FrontDoor() {
  return (
    <Card data-showcase-card="front-door">
      <CardHeader>
        <CardTitle>Front Door</CardTitle>
        <CardDescription>Smart Lock Pro</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5 text-sm text-secondary">
            Locked
            <IconPlaceholder
              lucide="LockIcon"
              tabler="IconLock"
              hugeicons="SquareLock02Icon"
              phosphor="LockKeyIcon"
              remixicon="RiLockLine"
              className="size-4"
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,var(--color-border)_10px,var(--color-border)_11px)]">
          <Badge variant="destructive" className="absolute top-2 right-2">
            Live
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
