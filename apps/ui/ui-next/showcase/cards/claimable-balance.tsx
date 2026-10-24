// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Badge } from "@ui-next/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui-next/components/card"
import { Item, ItemContent } from "@ui-next/components/item"
import { Separator } from "@ui-next/components/separator"

export function ClaimableBalance() {
  return (
    <Card data-showcase-card="claimable-balance">
      <CardHeader>
        <CardDescription>Claimable Balance</CardDescription>
        <CardTitle className="text-5xl tabular-nums">$0.00</CardTitle>
        <Badge variant="outline">
          <span className="size-2 rounded-full bg-yellow-500" />
          Pending Setup
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <Item variant="muted" className="flex-col items-stretch">
          <ItemContent className="gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">
                Net Royalties
              </span>
              <span className="text-sm font-medium tabular-nums">$0.00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">
                Processing Fee
              </span>
              <span className="text-sm font-medium tabular-nums">-$0.00</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">
                Total Ready to Claim
              </span>
              <span className="text-sm font-semibold tabular-nums">
                $0.00 USD
              </span>
            </div>
          </ItemContent>
        </Item>
      </CardContent>
      <CardFooter>
        <CardDescription>
          Once your bank is connected, balances over $10.00 are automatically
          eligible for monthly distribution on the 15th of each month.
        </CardDescription>
      </CardFooter>
    </Card>
  )
}
