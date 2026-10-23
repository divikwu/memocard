// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Label, Pie, PieChart } from "recharts"

import { Card, CardContent, CardFooter } from "@ui-next/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@ui-next/components/chart"
import { Separator } from "@ui-next/components/separator"

const chartData = [
  { name: "saved", value: 24000, fill: "var(--color-saved)" },
  { name: "remaining", value: 6000, fill: "var(--color-remaining)" },
]

const chartConfig = {
  saved: {
    label: "Saved",
    color: "var(--color-data-blue-2)",
  },
  remaining: {
    label: "Remaining",
    color: "var(--color-data-blue-1)",
  },
} satisfies ChartConfig

export function SavingsProgress() {
  return (
    <Card data-showcase-card="savings-progress">
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[220px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={95}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 12}
                          className="fill-primary text-2xl font-bold"
                        >
                          $24,000
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 12}
                          className="fill-secondary text-xs"
                        >
                          80% of $30,000
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-0">
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-sm text-secondary">
            Projected Finish
          </span>
          <span className="text-sm font-semibold">October 2024</span>
        </div>
        <Separator />
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-sm text-secondary">Monthly Average</span>
          <span className="text-sm font-semibold tabular-nums">$1,250</span>
        </div>
        <Separator />
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-sm text-secondary">Top Contributor</span>
          <span className="text-sm font-semibold">Auto-Transfer</span>
        </div>
      </CardFooter>
    </Card>
  )
}
