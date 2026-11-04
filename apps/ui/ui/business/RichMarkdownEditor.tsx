import { PopoverPortal } from '../components/popover';
import { DropdownMenuPortal } from '../components/dropdown-menu';
import { recoverableLazy } from "../components/recoverable-lazy";
import { createRichMarkdownEditor } from '../../src/rich-editor-core';
import { createRichHeadingFolding } from '../../src/rich-heading-fold-core';
import { createRichHeadingFoldButton } from '../../src/rich-heading-fold-button-core';
import { VaultImage } from './NoteMedia';
import { RichCodeBlock } from './RichCodeBlock';
import { RichImageTools } from './RichImageTools';
import { CalloutColorsMenu } from './CalloutColorsMenu';
import { NoteOutline } from './NoteOutline';
import { richIcons } from './rich-icons';
import './rich-editor.css';

const NoteMarkdown = recoverableLazy(() => import('./NoteMarkdown').then(module => ({ default: module.NoteMarkdown })), '原格式内容');
const RichFormatTools = recoverableLazy(() => import('./RichFormatTools').then(module => ({ default: module.RichFormatTools })), '格式工具');
const CalloutIconPicker = recoverableLazy(() => import('./CalloutIconPicker').then(module => ({ default: module.CalloutIconPicker })), '图标选择');
const RichHeadingFoldButton = createRichHeadingFoldButton(richIcons.ChevronRight);
const RichHeadingFolding = createRichHeadingFolding(RichHeadingFoldButton);
export type { RichEditorProps } from '../../src/rich-editor-core';
export const RichMarkdownEditor = createRichMarkdownEditor({
  PopoverPortal, MenuPortal: DropdownMenuPortal, RichHeadingFolding, icons: richIcons, Markdown: props => <NoteMarkdown {...props} />, NoteImage: VaultImage,
  RichCodeBlock, RichFormatTools, RichImageTools, CalloutColorsMenu, CalloutIconPicker,
  NoteOutline,
  contentClassName: 'markdown typeset typeset-memocard ui-note-markdown rich-editor-content', uiClassName: 'ui-rich-ui',
});
