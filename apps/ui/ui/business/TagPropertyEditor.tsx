import { createTagPropertyEditor } from "../../src/TagPropertyEditor.core";
import { Button } from "../components/button";
import { Skeleton } from "../components/skeleton";
import * as tooltips from "../components/tooltip";
import { propertyIcons } from "./property-editors";
import { TagOptionLabel, TagOptionSettings } from "./TagOption";

export const TagPropertyEditor = createTagPropertyEditor({ ...tooltips, TagOptionLabel, TagOptionSettings, X: propertyIcons.X, Button, Skeleton });
