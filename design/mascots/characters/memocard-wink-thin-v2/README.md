# Thin curved directions: memocard-wink

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Generated with the built-in image tool from the existing front and the user's thin-note screenshot. Revised directions only: narrow felt-sheet edge, gentle convex surface, small yaw/pitch and reduced diagonal roll. The original front cell is copied verbatim into the runtime atlas; original reactions stay unchanged. The previous direction atlas remains available.

Pipeline: prepare the raw sheet with local `prepare.py`; build with the page-mascot skill's content anchor and no vignette into `build/mascot-thin`; run `build/mascot-tools/bin/python design/mascots/characters/pack-thin-directions.py memocard-wink`. The packer corrects reversed left/right columns, fits each turn's visible bounds to the original front's width and height, fixes the center and baseline, and preserves the original front's RGBA pixels in a lossless atlas. Using one sheet-wide vertical scale was rejected because the generated side frames were up to 23% taller.

Validation: nine frames have visible bounds equal to the original front within one atlas pixel, clear cell margins and an exactly unchanged front. All 18 pointer-sector checks across both variants and both click/reset checks passed; browser console has no errors. Original reaction files are byte-identical. Skill verifier reports 0.00px click shift for both; TypeScript and targeted ESLint pass.

Runtime: `design/mascots/history/runtime-sheets/memocard-wink-thin-v2-directions.webp`, paired with existing `memocard-wink-reactions.webp`.

## Prompt

Use case: identity-preserve. Asset: revised 3x3 DIRECTION sprite sheet for the MemoCard wink-and-wave mascot.
Image1 is the exact canonical FRONT character to preserve: yellow fine felt square sticky note, large black round glasses, viewer-left eye winking, viewer-right eye open, black eyebrows and smile, top-right curled corner, black bow tie, raised viewer-left waving mitten, lower viewer-right hand holding yellow pencil with black cap. Image2 shows the APPROVED THIN, GENTLY CURVED NOTE STRUCTURE to use when this character turns. Ignore image2's different hands, open eyes, page text and card UI.
Generate NINE same-size drawings in exactly 3 columns x 3 rows of square cells on a square transparent canvas. The CENTER must match Image1's front drawing. All drawings retain Image1's face feature size, expression, props and felt rendering. Only orientation and thin curved note surface change.
CRITICAL STRUCTURE CORRECTION: this is a thin flexible sheet of felt, not a cushion, cube, pillow, tablet or thick box. Its side edge is extremely narrow, about 1-2% of frontal width. At side turns show only a sliver of material edge. The front sheet is gently convex/cupped: center softly bows forward and both side edges sweep slightly backward. Mild arc in the top/bottom edges to communicate flexible paper, not bulging plush stuffing. Same rounded corners, fine felt finish and recognizable upper-right fold.
TURNING: tiny yaw 8-12 degrees and pitch 5-7 degrees, preserve at least 94% of frontal face width, both circular lenses stay large and readable. No strong profile, no compressed lens, no shoulder or neck. Keep main surface broad at all turns. ALL TOP EDGES remain nearly HORIZONTAL. ALL SIDE EDGES nearly VERTICAL. Absolutely NO diagonal roll, leaning or diamond poses, including diagonal directions. Up-left means small yaw left + pitch up, NOT rotate the sprite in its image plane. Up/down changes perspective subtly.
EXACT CELL ORDER: row1 up-left/up/up-right; row2 viewer-left/FRONT/viewer-right; row3 down-left/down/down-right. Face direction is toward viewer's named side. Same wink and smile in all nine.
Hands/pencil keep exact original pose and size with minimal perspective shifts. Raised hand remains beside note; pencil stays held low right and angled up. Identical image scale, center and bottom baseline, no prop swinging.
Whole full character contained in each cell with generous transparent margins (around 70% cell size). No text, page UI, writing lines, shadow plane, backgrounds, borders, labels, wave marks or extra symbols. Real alpha transparent background.
