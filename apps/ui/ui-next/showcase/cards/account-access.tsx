// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Button } from "@ui-next/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui-next/components/card"
import { Field, FieldGroup, FieldLabel } from "@ui-next/components/field"
import { Input } from "@ui-next/components/input"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@ui-next/components/item"
import { IconPlaceholder } from "@ui-next/showcase-icons"

export function AccountAccess() {
  return (
    <Card data-showcase-card="account-access">
      <CardHeader>
        <CardTitle>Account Access</CardTitle>
        <CardDescription>
          Update your credentials or re-authenticate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email-address">Email Address</FieldLabel>
            <Input
              id="email-address"
              type="email"
              defaultValue="artist@studio.inc"
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="current-password">
                Current Password
              </FieldLabel>
              <a
                href="#"
                className="text-xs font-medium tracking-wider text-secondary uppercase hover:text-accent"
              >
                Forgot?
              </a>
            </div>
            <Input
              id="current-password"
              type="password"
              defaultValue="password123"
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <Button className="w-full">
          <IconPlaceholder
            lucide="LockKeyholeIcon"
            tabler="IconLock"
            hugeicons="SquareLock02Icon"
            phosphor="LockKeyIcon"
            remixicon="RiLockLine"
          />
          Update Security
        </Button>
        <Item variant="muted" render={<a href="#" />}>
          <ItemMedia variant="icon">
            <IconPlaceholder
              lucide="AlertCircleIcon"
              tabler="IconAlertCircle"
              hugeicons="AlertCircleIcon"
              phosphor="WarningCircleIcon"
              remixicon="RiErrorWarningLine"
              className="text-error"
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Danger Zone</ItemTitle>
            <ItemDescription className="line-clamp-1">
              Archive account and remove catalog
            </ItemDescription>
          </ItemContent>
          <IconPlaceholder
            lucide="ArrowRightIcon"
            tabler="IconArrowRight"
            hugeicons="ArrowRight01Icon"
            phosphor="ArrowRightIcon"
            remixicon="RiArrowRightLine"
            className="size-4"
          />
        </Item>
      </CardFooter>
    </Card>
  )
}
