import { lazy } from 'react';
import { Plus, GripVertical, Type, Heading, List, ListOrdered, ListTodo, Quote, Code, Minus, Table, Sigma, Image as ImageIcon, Search, ArrowUp, ArrowDown, Copy, Trash2, RefreshCw, Check, ChevronRight, MessageSquareQuote } from 'lucide-react';
import { createRichMarkdownEditor } from './rich-editor-core';
import { RichHeadingFolding } from './rich-heading-fold';
import { NoteImage } from './NoteImage';
import { RichCodeBlock } from './RichCodeBlock';
import { CalloutColorsMenu } from './CalloutColorsMenu';
import { RichImageTools } from './RichImageTools';
import './typeset.css';
import './block-controls.css';
import './rich-editor.css';
import './import-layout.css';
import './rich-image-layout.css';

const Markdown = lazy(() => import('./markdown').then(module => ({ default: module.Markdown })));
const RichFormatTools = lazy(() => import('./RichFormatTools').then(module => ({ default: module.RichFormatTools })));
const CalloutIconPicker = lazy(() => import('./CalloutIconPicker').then(module => ({ default: module.CalloutIconPicker })));
export type { RichEditorProps } from './rich-editor-core';
export const RichMarkdownEditor = createRichMarkdownEditor({
  RichHeadingFolding, icons: { Plus, GripVertical, Type, Heading, List, ListOrdered, ListTodo, Quote, Code, Minus, Table, Sigma, ImageIcon, Search, ArrowUp, ArrowDown, Copy, Trash2, RefreshCw, Check, ChevronRight, MessageSquareQuote },
  Markdown, NoteImage, RichCodeBlock, RichFormatTools, CalloutColorsMenu, RichImageTools, CalloutIconPicker,
});
