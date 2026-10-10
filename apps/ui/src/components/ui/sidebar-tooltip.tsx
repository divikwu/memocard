import type { ComponentProps, ReactElement } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

export default function SidebarTooltip({ button, hidden, content }: {
  button: ReactElement
  hidden: boolean
  content: ComponentProps<typeof TooltipContent>
}) {
  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent side="right" align="center" hidden={hidden} {...content} />
      </Tooltip>
    </TooltipProvider>
  )
}
