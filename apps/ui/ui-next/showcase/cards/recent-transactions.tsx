// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Button } from "@ui-next/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ui-next/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui-next/components/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@ui-next/components/table"
import { IconPlaceholder } from "@ui-next/showcase-icons"

export function RecentTransactions() {
  return (
    <Card data-showcase-card="recent-transactions">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Your latest account activity.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table aria-label="Recent transactions">
          <TableBody>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    lucide="CoffeeIcon"
                    tabler="IconCoffee"
                    hugeicons="CoffeeIcon"
                    phosphor="CoffeeIcon"
                    remixicon="RiCupLine"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Blue Bottle Coffee</span>
                  <span className="text-sm text-secondary">
                    Food & Drink
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-secondary">
                Today, 10:24 AM
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-semibold tabular-nums">
                  -$6.50
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="More actions for Blue Bottle Coffee"
                    render={<Button variant="ghost" size="icon-sm" />}
                  >
                    <IconPlaceholder
                      lucide="MoreHorizontalIcon"
                      tabler="IconDotsVertical"
                      hugeicons="MoreVerticalCircle01Icon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    lucide="ShoppingCartIcon"
                    tabler="IconShoppingCart"
                    hugeicons="ShoppingCart01Icon"
                    phosphor="ShoppingCartIcon"
                    remixicon="RiShoppingCartLine"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Whole Foods Market</span>
                  <span className="text-sm text-secondary">
                    Groceries
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-secondary">
                Yesterday
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-semibold tabular-nums">
                  -$142.30
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="More actions for Whole Foods Market"
                    render={<Button variant="ghost" size="icon-sm" />}
                  >
                    <IconPlaceholder
                      lucide="MoreHorizontalIcon"
                      tabler="IconDotsVertical"
                      hugeicons="MoreVerticalCircle01Icon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    lucide="WalletIcon"
                    tabler="IconWallet"
                    hugeicons="Wallet01Icon"
                    phosphor="WalletIcon"
                    remixicon="RiWalletLine"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Stripe Payout</span>
                  <span className="text-sm text-secondary">Income</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-secondary">
                Oct 12
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-semibold text-success tabular-nums">
                  +$4,200.00
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="More actions for Stripe Payout"
                    render={<Button variant="ghost" size="icon-sm" />}
                  >
                    <IconPlaceholder
                      lucide="MoreHorizontalIcon"
                      tabler="IconDotsVertical"
                      hugeicons="MoreVerticalCircle01Icon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    lucide="CarIcon"
                    tabler="IconCar"
                    hugeicons="Car01Icon"
                    phosphor="CarIcon"
                    remixicon="RiCarLine"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Uber Technologies</span>
                  <span className="text-sm text-secondary">
                    Transport
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-secondary">
                Oct 11
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-semibold tabular-nums">
                  -$24.10
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="More actions for Uber Technologies"
                    render={<Button variant="ghost" size="icon-sm" />}
                  >
                    <IconPlaceholder
                      lucide="MoreHorizontalIcon"
                      tabler="IconDotsVertical"
                      hugeicons="MoreVerticalCircle01Icon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    lucide="TvIcon"
                    tabler="IconDeviceTv"
                    hugeicons="Tv01Icon"
                    phosphor="TelevisionIcon"
                    remixicon="RiTvLine"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Netflix Subscription</span>
                  <span className="text-sm text-secondary">
                    Entertainment
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-secondary">
                Oct 10
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-semibold tabular-nums">
                  -$19.99
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="More actions for Netflix"
                    render={<Button variant="ghost" size="icon-sm" />}
                  >
                    <IconPlaceholder
                      lucide="MoreHorizontalIcon"
                      tabler="IconDotsVertical"
                      hugeicons="MoreVerticalCircle01Icon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
