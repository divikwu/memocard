# Design QA

## Evidence

- Source visual truth: the current MemoCard light-theme shell surrounding the note grid, plus the user-selected Notion gallery page on `https://app.notion.com/p/2dc0eb3ea8b480b8a04dfe79c198a870?v=2dc0eb3ea8b480eaa21f000cdfdb7f4d`. The reference page title computes to 32 px, 700 weight, and 38.4 px line height. The reference card's computed shadow is `0 4px 12px rgba(25,25,25,0.027), 0 1px 2px rgba(25,25,25,0.02), 0 0 0 1px rgba(42,28,0,0.07)`.
- Rendered implementation: `http://127.0.0.1:5173/tests/ui-preview.html?fixture=gallery#/notes`, captured in the Codex in-app browser with 12 in-memory notes.
- Desktop viewport: 1280 x 720 CSS px, device pixel ratio 2. Browser capture was normalized to the CSS viewport by the capture surface.
- Mobile viewport: 390 x 844 CSS px, device pixel ratio 2. Browser capture was normalized to the CSS viewport by the capture surface.
- State: light theme, populated all-notes list, one Markdown task-list note.

## Findings

No actionable P0, P1, or P2 issues remain.

- Typography: the visible page title matches the reference's 32 px size, 700 weight, and 38.4 px line height. Card titles use 16 px / 500 weight; dates and footer tags use 12 px, with the date remaining visually muted. Markdown preview text remains secondary, and headings and strong text are flattened so they do not compete with the note title.
- Spacing and layout: cards remain 256 px high and use the existing radius language. The note list now uses 16 px mobile gutters and 104 px desktop gutters, with no fixed maximum content width. Gallery columns fill the available width with a 320 px minimum card width and 16 px gaps; cards can shrink to the available width on narrow screens. The title, metadata, and card grid retain one shared alignment line.
- Colors and tokens: the card uses the semantic `card` surface token (`#ffffff` in light mode), the solid `accent` hover token (`#f8f8f8`), and the full `#eeeeee` border token. It adds the reference's two ambient shadow layers; the reference's third 1 px ring is omitted because MemoCard already has a dedicated border.
- Image quality: the target state contains no image asset, and no placeholder or generated image was introduced.
- Copy and content: the visible `编辑` control was removed. The card body is labeled as the note-open action; tags remain separate filter controls.
- Copy and content: standalone tag-only lines that duplicate the card footer are omitted from compact previews. Inline hashtags and fenced code remain unchanged.
- Accessibility and interaction: the card body is a native button with a visible focus ring through `focus-within`; opening a note and returning to the list were exercised. The rendered list contains one note-open button, zero `编辑` labels, and no browser warnings or errors.

## Focused comparison

The title, card, and surrounding MemoCard sidebar/header were reviewed in the same desktop capture. The title begins at the content column's left edge and creates the same page-to-grid hierarchy as the reference. The subtle outline and two low-opacity shadow layers separate the white card surface from the page without making it look raised or heavy. A focused browser inspection confirmed the title computes to 32 px / 700 / 38.4 px and the implementation shadow matches the two ambient layers measured from the selected Notion card. A 390 x 844 capture confirmed the title remains fully visible at 358 px content width without overflow.

## Comparison history

1. Initial equal-height pass used outlined cards, a document icon, header/footer dividers, a raised hover shadow, prominent Markdown hierarchy, and a visible `编辑` button. User feedback identified these as inconsistent and visually noisy.
2. Current pass removed the icon, button label, dividers, border, and shadow; converted the body to the primary open action; retained tag filters; and flattened compact Markdown typography. Desktop and 390 x 844 mobile captures show no remaining P0/P1/P2 mismatch.
3. The real-service capture exposed the same tag in both the Markdown body and card footer. Compact previews now filter only standalone duplicate tag lines; focused component coverage verifies that inline hashtag text remains visible.
4. User feedback requested a card outline. That pass added a low-contrast `border/60` stroke while preserving the equal height, muted fill, border radius, and shadow-free treatment.
5. Lightening every surface token by a full palette step made hierarchy too faint. The final middle tier uses `#eeeeee` for border/input, `#f8f8f8` for muted/accent, `neutral-50` for sidebar, and removes the card's extra border opacity. The captured result restores a readable outline without returning to the original contrast.
6. A color-meter capture measured the alpha-mixed card surface as `#fcfbfc`, exposing a one-channel tint after OKLab composition and screenshot color handling. The card now uses solid `rgb(251, 251, 251)`; browser-computed RGB channels are equal, with solid `rgb(238, 238, 238)` for the border.
7. The editor previously reserved a top-right row for routine save progress and success. Normal and in-progress autosave states are now silent; only failures and conflicts render the existing actionable alert. The captured normal editor state contains neither save-status copy nor an empty status row.
8. User feedback changed the note card from a faint gray surface to white with a visible outline. Browser-computed values confirm `rgb(255, 255, 255)` for the card surface and `rgb(238, 238, 238)` for the border; hover uses the existing solid accent surface.
9. User feedback requested a Notion-like shadow. The selected reference uses two ambient layers plus a 1 px shadow ring. MemoCard now matches the two ambient layers and keeps its existing `#eeeeee` border instead of duplicating the ring. The browser-rendered card remains 256 px high with a white surface, 14 px computed radius, and the requested soft elevation.
10. User feedback requested a visible page title based on the same Notion page. The formerly screen-reader-only list heading is now visible on note-list views at the measured 32 px / 700 / 38.4 px reference hierarchy. Desktop and 390 x 844 captures show consistent left alignment, no overlap, and no horizontal overflow; editor and settings views retain their existing title treatment.
11. User feedback identified the PC content gutter as too tight. The base 16 px gutter remains on mobile, while `md` and `xl` now use 32 px and 40 px respectively. The current 1252 px browser capture computes to 32 px on both sides and keeps the four-column grid container centered; automated coverage verifies all three responsive classes.
12. User feedback requested exact card typography adjustments. Browser-computed styles now confirm 16 px / 24 px line height for the card title and 12 px / 16 px line height for footer tags. The title remains single-line truncated, and the 40 px tag footer has no horizontal or vertical clipping in the populated fixture.
13. User feedback requested larger PC gutters. The desktop and extra-wide values increased to 40 px and 48 px while mobile remains 16 px. At the captured 1317 px viewport, the browser computes 48 px on both sides, keeps the content centered, and leaves each four-column card track about 229 px wide without clipping.
14. User feedback requested a 12 px card date. Browser-computed styles confirm 12 px type, 16 px line height, and the existing 4 px title-to-date gap; the muted color and card header height remain unchanged.
15. User feedback requested a 64 px extra-wide gutter. The `xl` value increased from 48 px to 64 px while mobile and regular desktop remain 16 px and 40 px. At the captured 1356 px viewport, the browser computes 64 px on both sides and keeps the four-column card track at 231 px without clipping; automated coverage verifies the responsive class.
16. User feedback requested one desktop gutter value. The separate 40 px desktop and 64 px extra-wide rules were consolidated into 64 px from the `md` breakpoint onward, leaving the 16 px mobile gutter unchanged. Browser checks compute 64 px on both sides at 1024 px and 1440 px viewports; card tracks remain 202.7 px and 252 px respectively without clipping.
17. User requested the measured Notion gallery layout. Note-list desktop gutters now use 104 px, the 1152 px content cap is removed, and columns use auto-fill with a 320 px minimum and 16 px gaps. Mobile cards fit their available width with 16 px gutters. Editor and settings gutters retain their existing values.
18. User requested more sample content. A separate `gallery` fixture provides 12 in-memory notes, including long titles, short and long prose, tasks, quotes, code, multiple tags, and an empty note. Browser verification confirms 12 cards at 256 px height, 2/3/4/6 columns at 1440/1680/1920/2560 px, and no horizontal overflow at 390/768/1024 px. The 256 px MemoCard sidebar makes the desktop transition widths 14 px earlier than the reference's 270 px sidebar. The travel tag correctly filters to one matching note.
19. User requested the measured Notion content-page layout. The default reading column is now 720 px (the existing narrower typography choices remain available), centered independently of the block-control gutter. Desktop margins are at least 96 px; the title, property-tag container, and editable document share the same column. The title uses 32 px / 700 / 1.2, and desktop content starts 96 px below the application header. A single shared floating control group sits outside the column: 24 x 24 px insertion button, 18 x 24 px grip, and a 10 px gap to the document. Existing first-line positioning and menu/drag logic are unchanged. Mobile retains a 48 px operation gutter, 16 px outer margins, and 32 px-high controls.
20. User requested further simplification after inspecting the container bounds. The editor now has the same width as the document itself, with zero horizontal padding; controls are absolutely positioned at -52 px on desktop and -48 px on mobile. The previous 800 px expanded wrapper is removed. Removing the redundant `55vh` body wrapper reduces the inspected sample's section from 792.2 px to 346.4 px, while retaining the existing editable minimum height and bottom writing space. Title, property tags, and visible text do not move.

## Content-page verification

- Isolated preview: `http://127.0.0.1:5173/tests/ui-preview.html?fixture=gallery#/notes/aaaaaaaa-bbbb-4ccc-8ddd-000000000002`.
- With the 256 px sidebar open, measured body widths at 768 / 1024 / 1455 / 1920 px are 320 / 576 / 720 / 720 px. Left and right margins inside the main pane are equal: 96 / 96 / 239.5 / 472 px.
- With the sidebar closed at 1024 px, body width remains 720 px, with 152 px on either side. At 390 px, body width is 310 px with a separate operation area; no horizontal overflow occurs.
- At all five tested widths, title, property-tag container, and body have identical left coordinates. Paragraph hover moves the one shared control group to the first line; desktop control dimensions and the 10 px document gap were measured in the rendered DOM.
- Native browser clicks verified returning to the note list and reopening another note, opening and dismissing block operations, and opening and closing insertion. At 390 px, the block menu fits at x=40..300 and insertion menu at x=16..336.
- UI typecheck and all 355 UI tests pass. This pass does not claim fresh real-vault persistence, IME, touch dragging, or long auto-scroll drag acceptance.
- Follow-up verification: the editor shell and editable document both measure 720 px on desktop, 576 px at 1024 px, and 310 px at 390 px, without overflow. On a temporary isolated preview (the original page's browser annotation overlay intercepted pointers), a drag from the left blank margin selected exactly two paragraphs and cleared the temporary selection rectangle on release. The floating grip opened the block menu and correctly reported two selected blocks. Typecheck, all 355 UI tests, production build, and diff whitespace checks pass again.

## Residual test gap

The gallery fixture now supplies multi-card browser evidence for equal heights and wrapping. Automated coverage verifies the grid, fixed height, missing `编辑` copy, note-open button, and duplicate-tag filtering. The installed service requires its normal one-use authorization link for a populated real-vault capture after restart; this pass verifies populated layout with the isolated mock fixture.

final result: passed
