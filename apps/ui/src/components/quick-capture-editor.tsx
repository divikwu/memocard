import { EditorContent } from '@tiptap/react';
import { useCaptureEditor, type CaptureEditorProps } from '../capture-editor';
import { RichTagSuggestions } from '../RichTagSuggestions';
import '../rich-editor.css';

export function QuickCaptureEditor(props: CaptureEditorProps) {
  const {value,tags,disabled}=props;
  const editor=useCaptureEditor(props);
  return <div className="quick-capture-editor rich-editor" data-empty={!value || undefined}>
    <EditorContent editor={editor}/>
    {editor && !disabled && <RichTagSuggestions editor={editor} names={tags}/>}
  </div>;
}
