import { createRichHeadingFolding } from './rich-heading-fold-core';
import { RichHeadingFoldButton } from './RichHeadingFoldButton';

export { unfoldRichHeadings } from './rich-heading-fold-core';
export const RichHeadingFolding = createRichHeadingFolding(RichHeadingFoldButton);
