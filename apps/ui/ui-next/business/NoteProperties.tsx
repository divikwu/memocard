import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Checkbox } from "../components/checkbox";
import { createNoteProperties } from "../../src/NoteProperties.core";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Textarea } from "../components/textarea";
import { Skeleton } from "../components/skeleton";
import * as popovers from "../components/popover";
import * as menus from "../components/dropdown-menu";
import * as tooltips from "../components/tooltip";
import { PageNotice } from "./PageNotice";
import { propertyIcons, collapsibles, NameEditor, TagPill, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor } from "./property-editors";

export const NoteProperties = createNoteProperties({ Checkbox: { Root: Checkbox, Indicator: CheckboxPrimitive.Indicator }, ...propertyIcons, ...collapsibles, ...popovers, ...menus, ...tooltips, Button, Input, Textarea, Skeleton, PageNotice, NameEditor, TagPill, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor });
export default NoteProperties;
