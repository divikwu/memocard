import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Checkbox } from "../components/checkbox";
import { createNoteProperties } from "../../src/NoteProperties.core";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Textarea } from "../components/textarea";
import { Skeleton } from "../components/skeleton";
import { PropertyPopover as Popover, PropertyPopoverContent as PopoverContent, PropertyPopoverTrigger as PopoverTrigger } from "./property-popover";
import { PropertyIconGlyph } from "./property-icon-catalog";
import { LazyPropertyIconPicker as PropertyIconPicker } from "./LazyPropertyIconPicker";
import * as menus from "../components/dropdown-menu";
import * as tooltips from "../components/tooltip";
import { PageNotice } from "./PageNotice";
import { PropertyConfirmationPortal, PropertyConfirmationPopup } from "./property-confirmation";
import { propertyIcons, collapsibles, NameEditor, TagPill, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor } from "./property-editors";

export const NoteProperties = createNoteProperties({ ConfirmationPortal: PropertyConfirmationPortal, ConfirmationPopup: PropertyConfirmationPopup, Checkbox: { Root: Checkbox, Indicator: CheckboxPrimitive.Indicator }, ...propertyIcons, ...collapsibles, Popover, PopoverContent, PopoverTrigger, ...menus, ...tooltips, Button, Input, Textarea, Skeleton, PageNotice, NameEditor, PropertyIconGlyph, PropertyIconPicker, TagPill, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor });
export default NoteProperties;
