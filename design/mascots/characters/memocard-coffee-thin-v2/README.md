# Thin curved directions: memocard-coffee

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Generated with the built-in image tool from the existing front and the user's thin-note screenshot. Revised directions only: narrow felt-sheet edge, gentle convex surface, small yaw/pitch and reduced diagonal roll. The original front cell is copied verbatim into the runtime atlas; original reactions stay unchanged. The previous direction atlas remains available.

Pipeline: prepare the raw sheet with local `prepare.py`; build with the page-mascot skill's content anchor and no vignette into `build/mascot-thin`; run `build/mascot-tools/bin/python design/mascots/characters/pack-thin-directions.py memocard-coffee`. The packer corrects reversed left/right columns, fits each turn's visible bounds to the original front's width and height, fixes the center and baseline, and preserves the original front's RGBA pixels in a lossless atlas. Using one sheet-wide vertical scale was rejected because the generated side frames were up to 23% taller.

Validation: nine frames have visible bounds equal to the original front within one atlas pixel, clear cell margins and an exactly unchanged front. All 18 pointer-sector checks across both variants and both click/reset checks passed; browser console has no errors. Original reaction files are byte-identical. Skill verifier reports 0.00px click shift for both; TypeScript and targeted ESLint pass.

Runtime: `design/mascots/history/runtime-sheets/memocard-coffee-thin-v2-directions.webp`, paired with existing `memocard-coffee-reactions.webp`.

## Prompt

Use case: identity-preserve. Asset: revised 3x3 DIRECTION sprite sheet for the coffee-and-pencil MemoCard.
Image1 is the exact canonical FRONT identity and pose. Image2 shows APPROVED THIN, GENTLY CURVED NOTE GEOMETRY ONLY; ignore its hands, face expression, text and UI. Keep Image1's coffee mug, pencil, eyes and face.
Create nine full-character drawings, 3 columns x 3 rows of square cells, square transparent PNG. Center FRONT must match Image1 exactly. Preserve fine golden-yellow felt, large black round glasses, TWO OPEN dark expressive eyes with highlights, small black smile and brows, top-right curled corner, black bow tie directly at bottom. Viewer-left mitten holds the same white ceramic coffee mug with brown coffee visible, viewer-right lower mitten holds yellow pencil with black cap, pale wood point and graphite tip. Same prop proportions and fixed grip in every frame.
STRUCTURE CHANGE ONLY: a THIN FLEXIBLE FELT SHEET with a gently convex front, center slightly forward and side edges curving slightly backward. Extremely narrow material edge about 1-2% of note width. Never show a thick side panel, pillow, cube, box or stuffed cushion. Subtle curved top/bottom edge like flexible stationery. Broad face stays readable.
Tiny yaw 8-12 degrees, pitch 5-7 degrees, retain at least 94% frontal face width and large circular glasses. All upper edges NEARLY HORIZONTAL and side edges upright. NO DIAGONAL ROLL, leaning or diamond shapes. Up-left means yaw left and pitch up rather than rolling. Turn the note surface, not just eyeballs.
ORDER: row1 up-left/up/up-right; row2 viewer-left/FRONT/viewer-right; row3 down-left/down/down-right. Left looks to viewer's left. Same open-eye smile and unchanged face feature scale in all cells.
Mug remains low left and LEVEL, coffee not spilling. Pencil stays angled upward at low right. Hands and props move only minimally with perspective, no waving or raised mug. No neck, shoulders, torso, legs or stand.
Same scale, center and bottom baseline in all cells, generous transparent gap on all four sides around complete character and props, about 70% cell size. No text, lines, page UI, labels, ground shadows, steam, floating symbols, backgrounds or checkerboard. Real alpha transparency.
