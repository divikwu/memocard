import { createTagPropertyEditor } from "../../src/TagPropertyEditor.core";
import { Button } from "../components/button";
import { Skeleton } from "../components/skeleton";
import * as tooltips from "../components/tooltip";
import { TagColorMenu, TagPill, propertyIcons } from "./property-editors";

export const TagPropertyEditor = createTagPropertyEditor({ ...tooltips, TagColorMenu, X: propertyIcons.X, Button, Skeleton, TagPill });
