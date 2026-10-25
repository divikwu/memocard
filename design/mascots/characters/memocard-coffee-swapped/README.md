# Swapped-hand coffee mascot

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Independent variant edited with the built-in image tool from the natural three-direction coffee character. Viewer-left hand holds the pencil; viewer-right hand holds the coffee mug. The folded upper-right corner, natural thin-note curvature and facial identity remain in place; this is not a mirrored character.

Three left/front/right views, repeated vertically in the directions atlas, plus nine front-facing expressions. Build uses the same uniform scaling and common baseline as the natural coffee version. Rebuild: `build/mascot-tools/bin/python design/mascots/characters/memocard-coffee-swapped/build.py`.

Source strips and aligned frames are saved in this directory. Runtime atlases: `design/mascots/history/runtime-sheets/memocard-coffee-swapped-{directions,reactions}.webp`.

## Validation

Aligned frame sizes are 265x274, 279x271 and 259x272 at 360px tile size, with one common 334px baseline and no anisotropic stretching. Both runtime atlases are 1080px square; directions have three distinct views repeated across rows, reactions have nine distinct cells, and all cells have clear alpha margins. Cropped left/front/right views were inspected: pencil stays viewer-left, cup stays viewer-right, fold stays upper-right.

Skill verification: 0.00px click shift, 97.4% minimum silhouette overlap, 65.5% palette match and 11.0% lower-band width change. Browser left/front/right, heart/sparkle/delighted/fourth-click dizzy/reset all passed; console is clean. TypeScript, targeted ESLint and diff checks pass. Original natural coffee atlas hashes are unchanged.

## Directions prompt

Use case: precise-object-edit. Asset: a NEW swapped-hand variant of the attached three-direction transparent mascot strip.
Change ONLY the two held props and their mitten grips in ALL THREE cells: the PENCIL must now be held in the LOWER HAND ON THE VIEWER'S LEFT, and the WHITE COFFEE MUG must now be held in the LOWER HAND ON THE VIEWER'S RIGHT.
The pencil keeps its short yellow-orange body, pale sharpened wood, black graphite tip and black end cap, angled upward and slightly outward on the LEFT, tip near mouth height. The mug is the same small white ceramic mug of brown coffee, on the RIGHT, handle toward the right-side gripping mitten; held low and level, rim below mouth, no steam/spill. Both arms attach naturally at low side edges; simple small felt mittens. Do not cross arms or put either prop in front of the face.
PRESERVE THE REST OF THE ATTACHED IMAGE EXACTLY: thin naturally curved nearly-square golden felt note, large black round glasses, two open dark expressive eyes, eyebrows and small smile, warm lighting, tactile fibers, black bow tie, note silhouette and proportions. CRITICAL: the physical folded corner stays at the UPPER-RIGHT of the note. Do not mirror or horizontally flip the complete character. Swap ONLY hand contents. All three current facing directions stay unchanged.
LAYOUT identical to reference: one horizontal row of THREE equal square cells, 3:1 wide PNG. Left cell faces viewer LEFT, middle FRONT, right viewer RIGHT. Same height, size, center and bottom baseline in all three cells. Keep the original natural whole-note yaw, gentle curve and thin edge. No pitch/roll, wider/squatter body, extra side panel, new seam, smaller glasses/eyes, text, writing strokes, labels, shadows, symbols or extra objects.
All characters and both props complete inside their own cells with generous alpha margins. Actual transparent background, no checkerboard. This should read as the same reference strip with only coffee and pencil exchanged between hands.

## Reactions prompt

Use case: precise-object-edit. Asset: matching transparent 3x3 expressions atlas for the swapped-hand coffee mascot.
Image1 is the existing nine-expression sheet to EDIT. Image2 is the NEW SWAPPED-HAND direction strip; use ONLY its MIDDLE FRONT pose to match the hand grips and prop positions.
In ALL NINE cells of Image1, exchange held props: viewer-LEFT lower mitten now holds the yellow-orange pencil (pale sharpened wood, black graphite and black end cap, angled up-left), viewer-RIGHT lower mitten now grasps handle of small white coffee mug with brown coffee, held low and level. Copy these new hand/prop drawings from Image2's middle pose exactly in ALL nine expressions. Do not cross arms, raise mug, tilt/spill coffee, add steam or cover face. Cup stays right, pencil stays left in EVERY cell.
Keep all other Image1 details: same naturally thin gently curved yellow felt note, fine texture and warm lighting, large round black glasses, note proportions and outline, bow tie. Folded physical corner ALWAYS stays UPPER-RIGHT; DO NOT mirror the whole image or move fold to upper-left. Do not widen/squash note or reduce face size.
Keep same nine expressions and symbols in SAME reading order:
1 both eyes closed happy arcs, small smile.
2 happy closed arcs/smile + tiny red heart above.
3 happy closed arcs/smile + three tiny golden sparkle stars above.
4 wide open eyes, surprised O mouth.
5 one winking eye, one open, smile.
6 gently closed eyes, soft modest smile, no blush.
7 sleepy closed eyes, tiny O mouth, tiny blue z z z above.
8 spiral eyes, wobbly mouth.
9 happy closed arcs and open happy grin with tiny pink tongue.
ALL nine face FRONT, exactly the same body, hand/prop silhouettes, scale, center and baseline, changing only eyes/brows/mouth and listed symbols. Use the front view in Image2 for base geometry.
Keep identical 3-column x 3-row square layout with wide alpha margins around each complete character and generous headroom above all cells. No clipping, boundaries, labels, writing strokes, ground shadows, checkerboard, backgrounds, watermark or extra objects. True alpha transparent PNG.
