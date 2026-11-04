import { createChoicePropertyEditor } from "../../src/ChoicePropertyEditor.core";
import { PropertyOptionMenu, propertyIcons } from "./property-editors";

export const { ChoicePropertyEditor } = createChoicePropertyEditor({ X: propertyIcons.X, PropertyOptionMenu });
