// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Bar, BarChart } from "recharts"

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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@ui-next/components/chart"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@ui-next/components/item"
import { IconPlaceholder } from "@ui-next/showcase-icons"

const HOLDINGS = [
  {
    name: "Vanguard VIG",
    shares: "450 Shares",
    amount: "$1,842.10",
    data: [
      { q: "Q1", value: 380 },
      { q: "Q2", value: 420 },
      { q: "Q3", value: 390 },
      { q: "Q4", value: 652 },
    ],
  },
  {
    name: "S&P 500 VOO",
    shares: "112 Shares",
    amount: "$928.40",
    data: [
      { q: "Q1", value: 180 },
      { q: "Q2", value: 210 },
      { q: "Q3", value: 320 },
      { q: "Q4", value: 218 },
    ],
  },
  {
    name: "Apple AAPL",
    shares: "85 Shares",
    amount: "$340.00",
    data: [
      { q: "Q1", value: 60 },
      { q: "Q2", value: 70 },
      { q: "Q3", value: 120 },
      { q: "Q4", value: 90 },
    ],
  },
  {
    name: "Realty Income",
    shares: "320 Shares",
    amount: "$1,139.50",
    data: [
      { q: "Q1", value: 240 },
      { q: "Q2", value: 260 },
      { q: "Q3", value: 280 },
      { q: "Q4", value: 360 },
    ],
  },
]

const miniChartConfig = {
  value: {
    label: "Dividend",
    color: "var(--color-data-blue-2)",
  },
} satisfies ChartConfig

export function DividendIncome() {
  const isRounded = true

  return (
    <Card data-showcase-card="dividend-income">
      <CardHeader>
        <CardTitle>Q2 Dividend Income</CardTitle>
        <CardDescription>
          Quarterly dividend payouts across your portfolio holdings.
        </CardDescription>
        <CardAction>
          <Button variant="secondary" size="icon-sm" aria-label="Dismiss dividend income">
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
        <ItemGroup>
          {HOLDINGS.map((holding) => (
            <Item key={holding.name} variant="muted">
              <ItemContent>
                <ItemTitle>{holding.name}</ItemTitle>
                <ItemDescription>{holding.shares}</ItemDescription>
              </ItemContent>
              <ChartContainer
                config={miniChartConfig}
                className="hidden h-8 w-24 md:block"
              >
                <BarChart
                  data={holding.data}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-value)"
                    radius={isRounded ? [3, 3, 0, 0] : 0}
                  />
                </BarChart>
              </ChartContainer>
              <span className="hidden text-sm font-semibold tabular-nums md:block">
                {holding.amount}
              </span>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
