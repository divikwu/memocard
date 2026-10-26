// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { useState } from "react"

import { Button } from "@ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/components/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@ui/components/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/select"
import { Switch } from "@ui/components/switch"
import { IconPlaceholder } from "@ui/showcase-icons"

const CURRENCIES = [
  { label: "USD — United States Dollar", value: "usd" },
  { label: "EUR — Euro", value: "eur" },
  { label: "GBP — British Pound", value: "gbp" },
  { label: "JPY — Japanese Yen", value: "jpy" },
]

export function Preferences() {
  const [currency, setCurrency] = useState("usd")
  const [publicStatistics, setPublicStatistics] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const reset = () => { setCurrency("usd"); setPublicStatistics(true); setEmailNotifications(true) }
  return (
    <Card data-showcase-card="preferences">
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Manage your account settings and notifications.
        </CardDescription>
        <CardAction>
          <Button variant="secondary" size="icon-sm" aria-label="Dismiss preferences">
            <IconPlaceholder
              lucide="XIcon"
              tabler="IconX"
              hugeicons="Cancel01Icon"
              phosphor="XIcon"
              remixicon="RiCloseLine"
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="default-currency">Default Currency</FieldLabel>
            <Select items={CURRENCIES} value={currency} onValueChange={(value) => setCurrency(value ?? "usd")}>
              <SelectTrigger id="default-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CURRENCIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <FieldSeparator className="-my-4" />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="public-statistics">
                Public Statistics
              </FieldLabel>
              <FieldDescription>
                Allow others to see your total stream count and listening
                activity
              </FieldDescription>
            </FieldContent>
            <Switch id="public-statistics" checked={publicStatistics} onCheckedChange={setPublicStatistics} />
          </Field>
          <FieldSeparator className="-my-4" />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="email-notifications">
                Email Notifications
              </FieldLabel>
              <FieldDescription>
                Monthly royalty reports and distribution updates
              </FieldDescription>
            </FieldContent>
            <Switch id="email-notifications" checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={reset}>Reset</Button>
        <Button className="ml-auto">Save Preferences</Button>
      </CardFooter>
    </Card>
  )
}
