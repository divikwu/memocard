import type { ComponentProps } from "react";
import { Button } from "../components/button";
import { AddIcon } from "../icons";
import { cnState } from "../lib/utils";

type CreateButtonProps = Omit<ComponentProps<typeof Button>, "type" | "variant" | "size">;

export function CreateButton({ children, className, ...props }: CreateButtonProps) {
  return <Button {...props} type="button" variant="outline" className={cnState(className, "bg-surface text-primary dark:bg-surface")}>
    <AddIcon aria-hidden="true" />
    {children}
  </Button>;
}
