# Natural coffee variant

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Built-in image editing adds a coffee mug to the approved original three-direction character, preserving its natural note curvature, folded corner, large face and pencil. This replaces the active coffee preview only; other characters remain unchanged.

Three horizontal views are repeated across atlas rows, as in the original sample. Vertical pointer positions reuse left/front/right. Nine matching expressions preserve the cup and pencil. The packer uses one uniform scale for all three directions, never separate horizontal/vertical stretching; matching reactions are uniformly scaled by character height. Rebuild from the repository root: `build/mascot-tools/bin/python design/mascots/characters/memocard-coffee-natural-v3/build.py`.

Runtime assets: `design/mascots/history/runtime-sheets/memocard-coffee-natural-v3-{directions,reactions}.webp`. Sources and aligned views are in this directory.

## Validation

Aligned full-frame sizes: left 273x274, front 287x271, right 254x272 at 360px tile size; common bottom baseline 334px. This is a 3px height range (1.17px at 140px display) with natural horizontal foreshortening and no anisotropic stretching. Nine reaction cells are distinct. Skill verifier reports 0.00px click shift, 98.1% minimum overlap and 67.2% palette match. Its 13.9% width metric averages yawed directions; comparing reactions directly with the front gives at most 6.6% lower-band width change.

Browser left/front/right, heart/sparkle/delighted/fourth-click dizzy and reset passed; console has no errors. Targeted ESLint and diff checks pass. Full-project TypeScript is blocked by an unrelated current error at `src/RichCodeBlock.tsx:7` (the value `code` is not assignable to `div`); that source was not changed by this mascot task. The original `memocard-three` atlases retain their previous SHA-256 hashes.

## Directions prompt

Use case: precise-object-edit. Asset: THREE-direction transparent sprite strip.
EDIT IMAGE1, do not redesign it. Image1 is the approved natural MemoCard character in three views and its exact natural shape/turning must stay intact. Image2 is ONLY a reference for a WHITE COFFEE MUG and hand grip; do not copy Image2's body, proportions, glasses, eyes, lighting or note shape.
PRIMARY CHANGE: in EACH of Image1's three drawings add a small white ceramic mug of brown coffee to the existing LOWER viewer-left hand. Adjust only that left mitten/short forearm as necessary to grasp the mug handle naturally. Keep cup low beside the lower-left note edge, rim below mouth, no face occlusion, cup height about 20-23% note height. The thumb grips handle; other fingers are a simple felt mitten, no human hand details. Cup rests upright and level, coffee visible, no steam, no spill. Minimal natural perspective differences for left/front/right.
STRICTLY KEEP Image1's thin gently curved note silhouette, HEIGHT AND WIDTH proportions, physical upper-right folded corner, fine yellow felt, LARGE black round glasses, two large open calm eyes, small smile, eyebrows, black bow tie, original right-hand pencil and grip, surface shading and natural three-dimensional yaw. Preserve original apparent sizes and exact center/baseline. DO NOT make note wider/squatter, flatten it into a rectangular slab, exaggerate side thickness, enlarge corners, shrink eyes or glasses, add seams/outline, change expression, rotate in-plane, change pose or alter right hand.
Same exact THREE cell layout as Image1: one horizontal row of THREE equal square cells on a 3:1 wide transparent PNG. LEFT cell faces viewer LEFT, MIDDLE faces FRONT, RIGHT faces viewer RIGHT, same as original. Three genuinely different orientations. The note's edges/face/eyes/glasses/fold/pencil all turn naturally together exactly like Image1. No extra frames.
Same physical size and nearly identical visible height in every cell; horizontal width may change slightly with true perspective. Generous empty alpha margin all sides, no clipping. No writing lines, text, borders, background, ground shadow, symbols or watermark. Real alpha transparency. Output should look like Image1 with only a cup added to each left hand.

## Reactions prompt

Use case: precise-object-edit. Asset: matching nine-expression transparent 3x3 sprite atlas.
EDIT IMAGE1 in place. Image1 is the approved nine-expression sheet for the natural MemoCard three-direction character. Image2 is the MATCHING NEW COFFEE DIRECTION STRIP; use ONLY Image2's MIDDLE FRONT drawing as the reference for coffee mug and left mitten grip.
Make the same exact 3 columns x 3 rows square sheet as Image1, same nine expressions and same layout. Change ONLY the viewer-left lower hand in each cell to naturally grasp a SMALL WHITE CERAMIC MUG of brown coffee, precisely matching the front pose in Image2. Cup height about 20-23% note height, low at lower-left edge, rim below mouth, no face occlusion. Handle on viewer-left with mitten gripping it; rim/coffee visible. The cup, handle, grip and short arm are the EXACT SAME DRAWING, position and scale across all nine cells. Do not raise mug, sip, tilt or spill. No steam.
Preserve ALL OTHER details from Image1 exactly: naturally thin gently curved yellow felt note outline and proportions, curled upper-right corner, large black round glasses, eyes/brows/mouth for each expression, pencil and right-hand grip, black bow tie, warm lighting, tactile felt surface. Do not widen/squash the note, add side panels, reduce glasses or restyle. Use Image2's FRONT body identity and prop size to match the direction sheet.
All nine characters remain FRONT FACING, fixed center/size/bottom baseline. Nine expressions in SAME READING ORDER as Image1:
1 closed happy arc eyes and small smile.
2 same closed arcs and smile + small red heart above.
3 same closed arcs and smile + three small gold sparkle stars above.
4 wide open eyes + small surprised O mouth.
5 one eye open and one winking + smile.
6 gently closed eyes + soft modest smile, no blush.
7 sleepy closed eyes + tiny O mouth + blue z z z above.
8 dark spiral eyes + small wobbly mouth.
9 closed happy arcs + open happy grin with tiny pink tongue.
Keep tiny symbols and generous identical transparent headroom. Whole characters/cups/pencils fully inside each cell with clear margin all sides. No writing strokes, backgrounds, ground shadows, grid lines, text labels, neck, shoulders, torso, legs or extra objects. Real alpha transparency. This should be Image1 with a cup added to each left hand, matching Image2's middle pose.
