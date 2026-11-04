import type { ComponentProps, ReactNode } from "react";
import { PropertyOptionsFailure } from "../../src/PropertyOptionsFailure";
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
import { ChoicePill } from "../../src/ChoicePill";
import { createTagColorMenu } from "../../src/TagColorMenu.core";
import { createImagePropertyEditor } from "../../src/ImagePropertyEditor.core";
import { createNameEditor } from "../../src/components/name-editor.core";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Badge } from "../components/badge";
import { recoverableLazy } from "../components/recoverable-lazy";
import { Skeleton } from "../components/skeleton";
import { Popover, PopoverContent } from "../components/popover";
import { PropertyPopover, PropertyPopoverContent, PropertyPopoverTrigger } from "./property-popover";
import { useIsMobile } from "../../src/hooks/use-mobile";
import * as menus from "../components/dropdown-menu";
import { Sheet, SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { cn, cnState } from "../lib/utils";
import { ImageViewer } from "./NoteMedia";
import { richIcons } from "./rich-icons";
import { PropertyConfirmationPortal, PropertyConfirmationPopup } from "./property-confirmation";
import "./tag.css";
import "./note-properties.css";

function PropertyEditorFailure({ values, retry, title }: { values?:ReactNode; retry:()=>void; title:string }) {
  const failure = <PropertyOptionsFailure retry={<Button variant="ghost" className="note-property-retry" onClick={retry} aria-label={`重试加载${title}`}>重试</Button>} />;
  if (values === undefined) return failure;
  return <div className="note-tag-editor">
    <div className="note-tag-header"><div className="note-tag-selected">{values}</div></div>
    <div className="note-tag-body">{failure}</div>
  </div>;
}

export const DatePropertyPicker = recoverableLazy(() => import("./DatePropertyPicker").then(module => ({ default: module.DatePropertyPicker })), "日期", (_, retry) => <PropertyEditorFailure retry={retry} title="日期" />);
export const TagPropertyEditor = recoverableLazy(() => import("./TagPropertyEditor").then(module => ({ default: module.TagPropertyEditor })), "标签", (props, retry) => <PropertyEditorFailure values={[...new Set([...props.tags, ...(props.bodyTags ?? [])])].map(tag => <TagPill key={tag} name={tag} className={props.tags.includes(tag) ? "note-tag-reserved" : undefined} />)} retry={retry} title="标签" />);
export const ChoicePropertyEditor = recoverableLazy(() => import("./ChoicePropertyEditor").then(module => ({ default: module.ChoicePropertyEditor })), "选项", ({ property }, retry) => <PropertyEditorFailure values={<span className="note-property-tags">{(Array.isArray(property.value) ? property.value : property.value ? [String(property.value)] : []).map(value => <ChoicePill key={value} name={value} options={property.options} />)}</span>} retry={retry} title="选项" />);
export { ChoicePill };

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

const SharedNameEditor = createNameEditor({ Popover, PopoverContent, Button, Input, Sheet, SheetClose: SheetCloseButton, SheetContent, SheetHeader, SheetTitle, X: propertyIcons.X });
export function NameEditor(props: ComponentProps<typeof SharedNameEditor>) {
  const mobile = useIsMobile();
  return <SharedNameEditor {...props} className={cn("note-property-name-popup", props.className)} sheet={props.sheet || mobile} />;
}
export const PropertyOptionMenu = createPropertyOptionMenu({ ...menus, ...propertyIcons, Button, Input, TagPill, ConfirmationPortal: PropertyConfirmationPortal, ConfirmationPopup: PropertyConfirmationPopup });
export const TagColorMenu = createTagColorMenu({ PropertyOptionMenu });
export const ImagePropertyEditor = createImagePropertyEditor({ ...menus, ...propertyIcons, Button, Skeleton, Popover: PropertyPopover, PopoverContent: PropertyPopoverContent, PopoverTrigger: PropertyPopoverTrigger, DropdownMenuContent: props => <menus.DropdownMenuContent {...props} className={cnState(props.className, "note-property-image-menu")} />, ImageViewer });
export const collapsibles = { Collapsible: CollapsiblePrimitive.Root, CollapsibleContent: CollapsiblePrimitive.Panel, CollapsibleTrigger: CollapsiblePrimitive.Trigger };
