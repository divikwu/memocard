// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { useEffect, useRef, useState } from "react"
import { Bar, BarChart, XAxis } from "recharts"
import { usePreviewAppearance } from "@ui/preview-mode"

import { Button } from "@ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@ui/components/chart"
import {
  Item,
  ItemContent,
  ItemDescription,
} from "@ui/components/item"

const chartData = [
  { month: "Dec", amount: 800 },
  { month: "Jan", amount: 1100 },
  { month: "Feb", amount: 900 },
  { month: "Mar", amount: 1300 },
  { month: "Apr", amount: 750 },
  { month: "May", amount: 1400 },
]

const chartConfig = {
  amount: {
    label: "Contribution",
    color: "var(--color-data-blue-2)",
  },
} satisfies ChartConfig

export function ContributionHistory() {
  const chartRef = useRef<HTMLDivElement>(null)
  const { radius } = usePreviewAppearance()
  const [barRadius, setBarRadius] = useState(0)

  // Recharts requires numeric radii, so resolve the CSS role in pixels.
  useEffect(() => {
    if (chartRef.current) {
      setBarRadius(parseFloat(getComputedStyle(chartRef.current).borderTopLeftRadius))
    }
  }, [radius])

  return (
    <Card data-showcase-card="contribution-history">
      <CardHeader>
        <CardTitle>Contribution History</CardTitle>
        <CardDescription>Last 6 months of activity</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer ref={chartRef} config={chartConfig} className="h-[200px] w-full rounded-element">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
          >
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel className="min-w-40" />}
            />
            <Bar
              dataKey="amount"
              fill="var(--color-amount)"
              radius={[barRadius, barRadius, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardContent>
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          <Item variant="muted" className="flex-col items-stretch">
            <ItemContent className="gap-1">
              <ItemDescription className="text-xs font-medium tracking-wider text-secondary uppercase">
                Upcoming
              </ItemDescription>
              <span className="font-heading text-lg font-semibold">
                May 25, 2024
              </span>
              <span className="text-sm text-secondary">
                $1,000 scheduled
              </span>
            </ItemContent>
          </Item>
          <Item variant="muted" className="flex-col items-stretch">
            <ItemContent className="gap-1">
              <ItemDescription className="text-xs font-medium tracking-wider text-secondary uppercase">
                Auto-Save Plan
              </ItemDescription>
              <span className="font-heading text-lg font-semibold">
                Accelerated
              </span>
              <span className="text-sm text-secondary">
                Recurring weekly
              </span>
            </ItemContent>
          </Item>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">View Full Report</Button>
      </CardFooter>
    </Card>
  )
}
