// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Button } from "@ui-next/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui-next/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@ui-next/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@ui-next/components/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
} from "@ui-next/components/item"
import { Progress } from "@ui-next/components/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-next/components/select"

const ORDER_TYPES = [
  { label: "Market Order", value: "market" },
  { label: "Limit Order", value: "limit" },
  { label: "Stop Order", value: "stop" },
]

export function SavingsTargets() {
  return (
    <div className="grid grid-cols-2 gap-(--gap)">
      <Card data-showcase-card="savings-targets">
        <CardHeader>
          <CardTitle>Savings Targets</CardTitle>
          <CardDescription>Active milestones for 2024</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm">
              New Goal
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-3">
            <Item variant="muted" className="flex-col items-stretch">
              <ItemContent className="gap-3">
                <ItemDescription className="font-heading text-xs font-medium tracking-wider text-secondary uppercase">
                  Retirement
                </ItemDescription>
                <span className="text-3xl font-semibold tabular-nums">
                  $420,000
                </span>
                <Progress value={65} />
              </ItemContent>
              <ItemFooter>
                <span className="text-sm text-secondary">
                  65% achieved
                </span>
                <span className="text-sm font-medium tabular-nums">
                  $273,000
                </span>
              </ItemFooter>
            </Item>
            <Item variant="muted" className="flex-col items-stretch">
              <ItemContent className="gap-3">
                <ItemDescription className="font-heading text-xs font-medium tracking-wider text-secondary uppercase">
                  Real Estate
                </ItemDescription>
                <span className="text-3xl font-semibold tabular-nums">
                  $85,000
                </span>
                <Progress value={32} />
              </ItemContent>
              <ItemFooter>
                <span className="text-sm text-secondary">
                  32% achieved
                </span>
                <span className="text-sm font-medium tabular-nums">
                  $27,200
                </span>
              </ItemFooter>
            </Item>
          </ItemGroup>
        </CardContent>
        <CardFooter>
          <CardDescription className="text-center">
            You have not met your targets for this year.
          </CardDescription>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Buy Investment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <FieldGroup className="flex-1">
            <Field>
              <FieldLabel htmlFor="invest-amount">Amount to Invest</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput id="invest-amount" defaultValue="1,000.00" />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="invest-type">Order Type</FieldLabel>
              <Select items={ORDER_TYPES} defaultValue="market">
                <SelectTrigger id="invest-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ORDER_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Market orders execute at the current price.
              </FieldDescription>
            </Field>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">
                  Estimated Shares
                </span>
                <span className="text-sm font-semibold tabular-nums">1.95</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">
                  Buying Power
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  $12,450.00
                </span>
              </div>
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button className="w-full">Review Order</Button>
          <CardDescription className="text-center">
            Trades are typically executed within minutes during market hours.
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  )
}
