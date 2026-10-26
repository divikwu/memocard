import { createEditor } from '../../src/editor-core';
import { Button } from '../components/button';
import { PageNotice } from './PageNotice';
import NoteProperties from './NoteProperties';
import { RichMarkdownEditor } from './RichMarkdownEditor';
import './Editor.css';

export type { EditorHandle, EditorProps } from '../../src/editor-core';
export const Editor = createEditor({
  Button, PageNotice, NoteProperties, RichMarkdownEditor,
  className: 'note-editor ui-note-editor', contentClassName: 'ui-editor-document',
});
