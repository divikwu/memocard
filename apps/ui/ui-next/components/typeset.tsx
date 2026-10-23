import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

export function Typeset({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="typeset" className={cn("typeset typeset-memocard", className)} {...props} />;
}
