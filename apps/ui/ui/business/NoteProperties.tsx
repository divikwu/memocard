import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Checkbox } from "../components/checkbox";
import { createNoteProperties } from "../../src/NoteProperties.core";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Textarea } from "../components/textarea";
import { Skeleton } from "../components/skeleton";
import { PropertyPopover as Popover, PropertyPopoverContent as PopoverContent, PropertyPopoverTrigger as PopoverTrigger } from "./property-popover";
import * as menus from "../components/dropdown-menu";
import * as tooltips from "../components/tooltip";
import { PageNotice } from "./PageNotice";
import { PropertyConfirmationPopup } from "./property-confirmation";
import { propertyIcons, collapsibles, NameEditor, TagPill, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor } from "./property-editors";

export const NoteProperties = createNoteProperties({ ConfirmationPopup: PropertyConfirmationPopup, Checkbox: { Root: Checkbox, Indicator: CheckboxPrimitive.Indicator }, ...propertyIcons, ...collapsibles, Popover, PopoverContent, PopoverTrigger, ...menus, ...tooltips, Button, Input, Textarea, Skeleton, PageNotice, NameEditor, TagPill, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor });
export default NoteProperties;
