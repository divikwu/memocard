# MemoCard primary mascot

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

The selected swapped-hand design is the primary MemoCard mascot: viewer-left pencil, viewer-right coffee mug, upper-right folded corner, natural thin gently curved golden felt note, large black glasses and black bow tie.

Nine directions include shallow up/down pitch. The middle row (left/front/right) is copied pixel-for-pixel from the approved `memocard-coffee-swapped-directions.webp`; the reaction file is copied byte-for-byte from the approved swapped-hand version. Six pitch views are generated with the built-in image tool and aligned using uniform per-frame scaling, fixed height and baseline; there is no separate horizontal/vertical stretching.

Build: `build/mascot-tools/bin/python design/mascots/characters/memocard-primary/build.py`. Runtime: `apps/ui/mascot-fixtures/memocard-primary-{directions,reactions}.webp`. Raw generated directions and aligned frames remain in this directory. Earlier iteration assets remain available in sibling directories.

Nine reaction slots: blink, heart, sparkle, surprised, wink, bashful, sleepy, dizzy, delighted. The page-mascot click interaction uses blink followed by heart/sparkle/delighted and dizzy after four quick clicks.

## Validation

Both atlases contain nine distinct 360px cells on a 1080px square canvas, with clear alpha margins. Visible direction heights are 269-272px with a common 333px baseline, a 1.17px height range at 140px display size. Left/right and diagonal cells were inspected. Assertions confirm the three approved horizontal cells are RGBA-identical and the reaction atlas is byte-identical.

Skill verifier: 0.00px click shift, 97.4% minimum lower-band silhouette overlap, 61.8% palette match and 8.7% lower-band width change. Browser checks passed for all nine pointer sectors and heart/sparkle/delighted/fourth-click dizzy/reset; console is clean. TypeScript, targeted ESLint and diff checks passed.

## Bottom-fade preview variant

The gallery also renders an independent "MemoCard · 渐隐版" instance using the same unchanged atlases. A wrapper alpha mask fades from opaque at 76% of the tile to transparent at 93%. A pointer-transparent backdrop blur overlay gradually reveals a 2.5px blur over that same bottom band. This preserves all face pixels above the band and keeps every direction and reaction synchronized without redrawing or altering source images. The original instance has no mask or blur. Browser heart/sparkle/delighted/dizzy/reset checks pass for the faded instance; TypeScript, targeted ESLint and diff checks pass.

## Directions prompt

Use case: identity-preserve. Asset: COMPLETE NINE-DIRECTION sprite sheet for approved MemoCard mascot.
Image1 is the EXACT APPROVED natural LEFT / FRONT / RIGHT strip. Image2 is its aligned FRONT. Preserve this character's physical geometry, proportions, natural sheet curvature and expressive large face exactly. Expand the strip into 3 columns x 3 rows square PNG with true transparent background.
Character: golden-yellow fine felt thin gently curved nearly-square sticky note, upper-right physical folded corner, large thick round black glasses and large calm OPEN eyes, curved brows, gentle small smile, black bow tie directly at note bottom. LOWER VIEWER-LEFT hand holds yellow-orange pencil with black cap, pale sharpened wood and black tip angled upward-left. LOWER VIEWER-RIGHT hand grasps handle of small white ceramic coffee mug with brown coffee visible, held low and level. Hands and props stay on these same sides in ALL cells. Never mirror the character or fold.
EXACT DIRECTIONS in reading order:
Row1: use Image1 LEFT view with tiny UP pitch; use FRONT with tiny UP pitch; use RIGHT view with tiny UP pitch.
Row2: reproduce Image1 LEFT; reproduce Image1 FRONT; reproduce Image1 RIGHT.
Row3: use Image1 LEFT with tiny DOWN pitch; use FRONT with tiny DOWN pitch; use RIGHT with tiny DOWN pitch.
Left/right always mean viewer's side, face and glasses point that way. Preserve original modest yaw. Pitch is only 5-6 degrees. Up/down is a natural shallow perspective tilt of the thin note, not looking just with pupils and not rolling/leaning. Do not make a thick cube. Keep gentle convex note surface and very narrow felt edge, no broad sidewalls. Both eyes/glasses lenses remain large/readable.
CONSISTENCY IS CRITICAL: SAME unprojected note height and width and face/prop scale across all nine images, same center and bottom baseline. All images stay nearly upright. No strong diagonal roll, squeezing tall, stretching wide, zoom, changing bow tie or coffee/pencil proportions. All faces keep same relaxed open-eye smile; no expression changes or symbols. Draw matching note/face/props once and render tiny viewpoint changes of that same object. Mug remains steady level, no steam/spill. Natural perspective like the approved strip.
Square PNG, exactly three columns and three rows of equal square cells, full character occupies roughly 65-70% cell size with generous clear transparent margins on all four sides. No clipping, cell overlap, labels, grid, text, writing lines, floor shadow, scenery, neck, shoulders, body pedestal, legs, hearts/stars/tears or watermark. Exact golden fine-felt rendering and warm lighting of approved images. Real alpha background.
