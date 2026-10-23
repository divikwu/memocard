import { useCallback, type ComponentProps } from "react";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import type { RichIcon } from "../../src/rich-editor-core";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import Clock01Icon from "@hugeicons/core-free-icons/Clock01Icon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import CheckmarkSquare02Icon from "@hugeicons/core-free-icons/CheckmarkSquare02Icon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowDown02Icon from "@hugeicons/core-free-icons/ArrowDown02Icon";
import SlidersHorizontalIcon from "@hugeicons/core-free-icons/SlidersHorizontalIcon";
import HashtagIcon from "@hugeicons/core-free-icons/HashtagIcon";
import ImageAdd02Icon from "@hugeicons/core-free-icons/ImageAdd02Icon";
import Maximize01Icon from "@hugeicons/core-free-icons/Maximize01Icon";
import { createPropertyOptionMenu } from "../../src/PropertyOptionMenu.core";
import { createChoicePropertyEditor } from "../../src/ChoicePropertyEditor.core";
import { createTagColorMenu } from "../../src/TagColorMenu.core";
import { createTagPropertyEditor } from "../../src/TagPropertyEditor.core";
import { createDatePropertyPicker } from "../../src/DatePropertyPicker.core";
import { createImagePropertyEditor } from "../../src/ImagePropertyEditor.core";
import { createNameEditor } from "../../src/components/name-editor.core";
import { installSheetSwipe } from "../../src/sheet-swipe";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Badge } from "../components/badge";
import { Calendar } from "../components/calendar";
import { Switch } from "../components/switch";
import { Skeleton } from "../components/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import * as menus from "../components/dropdown-menu";
import * as tooltips from "../components/tooltip";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { cn } from "../lib/utils";
import { ImageViewer } from "./NoteMarkdown";
import { richIcons } from "./rich-icons";
import "./note-properties.css";

const icon = (data: HugeiconsIconProps["icon"]): RichIcon => props => <HugeiconsIcon icon={data} {...props} strokeWidth={Number(props.strokeWidth ?? 2)} />;
export const propertyIcons = {
  ...richIcons, CalendarDays: icon(Calendar03Icon), LoaderCircle: icon(Loading03Icon), Clock: icon(Clock01Icon),
  ChevronDown: icon(ArrowDown01Icon), ChevronUp: icon(ArrowUp01Icon), Text: richIcons.Type,
  SquareCheck: icon(CheckmarkSquare02Icon), Pencil: icon(PencilEdit02Icon), CircleChevronDown: icon(ArrowDown02Icon),
  ListChecks: richIcons.ListTodo, SlidersHorizontal: icon(SlidersHorizontalIcon), Image: richIcons.ImageIcon,
  Hash: icon(HashtagIcon), ImagePlus: icon(ImageAdd02Icon), Maximize: icon(Maximize01Icon),
};

export function TagPill({ name, className, children, ...props }: ComponentProps<typeof Badge> & { name: string }) {
  return <Badge variant="secondary" {...props} data-tag={encodeURIComponent(name)} className={cn("note-tag-pill", className)}>{children ?? name}</Badge>;
}

function PropertySheetSwipe({ disabled }: { disabled: boolean }) {
  const attach = useCallback((button: HTMLButtonElement | null) => button ? installSheetSwipe(button.parentElement!, () => button.click(), disabled) : undefined, [disabled]);
  return <><div data-slot="sheet-handle" aria-hidden="true" /><SheetClose ref={attach} hidden /></>;
}

function NameSheetContent({ children, swipeToClose, swipeDisabled, forceBackdrop, ...props }: ComponentProps<typeof import("../../src/components/ui/sheet").SheetContent>) {
  void forceBackdrop;
  return <SheetContent {...props}>{swipeToClose && <PropertySheetSwipe disabled={!!swipeDisabled} />}{children}</SheetContent>;
}

export const NameEditor = createNameEditor({ Popover, PopoverContent, Button, Input, Sheet, SheetClose, SheetContent: NameSheetContent, SheetHeader, SheetTitle, X: propertyIcons.X });
export const PropertyOptionMenu = createPropertyOptionMenu({ ...menus, ...propertyIcons, Button, Input, TagPill });
export const { ChoicePropertyEditor, ChoicePill } = createChoicePropertyEditor({ X: propertyIcons.X, PropertyOptionMenu });
export const TagColorMenu = createTagColorMenu({ PropertyOptionMenu });
export const TagPropertyEditor = createTagPropertyEditor({ ...tooltips, TagColorMenu, X: propertyIcons.X, Button, TagPill });
export const DatePropertyPicker = createDatePropertyPicker({ DayPicker: Calendar, Button, Input, Switch });
export const ImagePropertyEditor = createImagePropertyEditor({ ...menus, ...propertyIcons, Button, Skeleton, Popover, PopoverContent, PopoverTrigger, ImageViewer });
export const collapsibles = { Collapsible: CollapsiblePrimitive.Root, CollapsibleContent: CollapsiblePrimitive.Panel, CollapsibleTrigger: CollapsiblePrimitive.Trigger };
