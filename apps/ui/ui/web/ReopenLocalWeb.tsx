import { buttonVariants } from "../components/button";

export function ReopenLocalWeb({ inline }: { inline?: boolean }) {
  return <a href="memocard-service://open-web" data-slot="button" className={buttonVariants(inline ? { variant: "outline", size: "sm" } : {})}>重新打开</a>;
}
