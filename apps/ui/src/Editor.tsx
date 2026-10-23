import { Button } from '@/components/ui/button';
import { PageNotice } from '@/components/page-notice';
import { RichMarkdownEditor } from './RichMarkdownEditor';
import NoteProperties from './NoteProperties';
import { createEditor } from './editor-core';
import './Editor.css';

export type { EditorHandle, EditorProps } from './editor-core';
export const Editor = createEditor({ Button, PageNotice, RichMarkdownEditor, NoteProperties });
