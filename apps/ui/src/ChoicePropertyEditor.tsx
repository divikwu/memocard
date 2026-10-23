import { X } from 'lucide-react';
import PropertyOptionMenu from './PropertyOptionMenu';
import { createChoicePropertyEditor } from "./ChoicePropertyEditor.core";
const { ChoicePropertyEditor, ChoicePill } = createChoicePropertyEditor({ X, PropertyOptionMenu });
export { ChoicePill };
export default ChoicePropertyEditor;
