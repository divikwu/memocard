import type { ComponentProps } from "react";
import { createNameEditor } from "../../src/components/name-editor.core";
import { useIsMobile } from "../../src/hooks/use-mobile";
import { Input } from "../components/input";
import { Popover, PopoverContent } from "../components/popover";
import { Sheet, SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { cn } from "../lib/utils";
import "./note-properties.css";

const SharedNameEditor = createNameEditor({ Popover, PopoverContent, Input, Sheet, SheetClose: SheetCloseButton, SheetContent, SheetHeader, SheetTitle });

export function NameEditor(props: ComponentProps<typeof SharedNameEditor>) {
  const mobile = useIsMobile();
  return <SharedNameEditor {...props} className={cn("note-property-name-popup w-80 p-2", props.className)} sheet={props.sheet ?? mobile} />;
}
