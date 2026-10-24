import { lazy } from 'react';
import { createRichMarkdownEditor } from '../../src/rich-editor-core';
import { createRichHeadingFolding } from '../../src/rich-heading-fold-core';
import { createRichHeadingFoldButton } from '../../src/rich-heading-fold-button-core';
import { NoteMarkdown, VaultImage } from './NoteMarkdown';
import { RichCodeBlock } from './RichCodeBlock';
import { RichImageTools } from './RichImageTools';
import { CalloutColorsMenu } from './CalloutColorsMenu';
import { richIcons } from './rich-icons';
import './rich-editor.css';

const RichFormatTools = lazy(() => import('./RichFormatTools').then(module => ({ default: module.RichFormatTools })));
const CalloutIconPicker = lazy(() => import('./CalloutIconPicker').then(module => ({ default: module.CalloutIconPicker })));
const RichHeadingFoldButton = createRichHeadingFoldButton(richIcons.ChevronRight);
const RichHeadingFolding = createRichHeadingFolding(RichHeadingFoldButton);
export type { RichEditorProps } from '../../src/rich-editor-core';
export const RichMarkdownEditor = createRichMarkdownEditor({
  RichHeadingFolding, icons: richIcons, Markdown: NoteMarkdown, NoteImage: VaultImage,
  RichCodeBlock, RichFormatTools, RichImageTools, CalloutColorsMenu, CalloutIconPicker,
  contentClassName: 'markdown typeset typeset-memocard note-markdown-next rich-editor-content', uiClassName: 'next-rich-ui',
});
