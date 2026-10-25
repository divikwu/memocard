# memocard-coffee

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Independent reference-based variant generated with the built-in image generation tool, using the page-mascot workflow. Viewer-left coffee mug, viewer-right pencil, default open-eye smile. Existing characters are preserved.

Source reference, raw sheets, prepared sheets and front reference are saved here. Runtime assets are served from `design/mascots/history/runtime-sheets/memocard-coffee-{directions,reactions}.webp`.

The whole note with attached hands and props rotates as one character. Use content anchoring and no bust vignette. Build with the local `build/mascot-tools/bin/python`, the skill's `build.py memocard-coffee --anchor content --no-vignette`, and `MASCOT_ROOT=design/mascots MASCOT_DEST=design/mascots/history/runtime-sheets`. Run local `prepare.py` first, then skill `verify.py memocard-coffee`.

## Validation

Skill verifier: 0.00px reaction shift at 140px display size, 97.8% minimum lower-band silhouette overlap, 89.8% palette match, 7.4% lower-body width change. Both atlases are 1080 square with nine distinct 360px frames and clear cell-edge margins. Left/right cells were cropped and visually checked.

Browser: all nine pointer sectors, heart/sparkle/delighted/fourth-click dizzy, reset and Enter activation passed for both variants. The 375px layout has no horizontal overflow and the test console has no errors. TypeScript, targeted ESLint and diff checks passed. Existing original and greeting atlas hashes are unchanged.

## Directions prompt

Use case: stylized-concept. Asset type: production 3x3 DIRECTION sprite sheet for page-mascot based faithfully on the attached coffee mascot reference. A matching expression sheet will follow.
Create exactly nine FULL-CHARACTER poses of this same fine golden-yellow felt sticky-note character, arranged in 3 columns x 3 rows of equal square cells, square transparent PNG.
IDENTITY: broad nearly square THIN flat note slab, softly rounded rim and corners, physical curled upper-right corner, VERY LARGE thick round black glasses occupying most of face width, large dark friendly open eyes with white catchlights and the small scalloped lower eye edge from reference, curved black eyebrows, small curved smile, black bow tie directly at the note's bottom center. Match reference warm yellow fine felt fibers, black satin glasses/bow tie and softly lit 3D tactile style. No lines or text on note; no shoulders, torso, neck or legs.
HAND AND PROP LOCK IN ALL NINE CELLS: viewer-left short side-connected felt arm and mitten grasp the handle of the same white ceramic coffee mug, brown coffee visible at rim, cup positioned low at left like reference. Viewer-right lower mitten holds same yellow-orange pencil, pale wood point, black graphite and black cap, diagonally upward. No waving hands in this variant. Same mug size/shape, grip, pencil size/angle and bow tie placement across all poses; cup kept steady and level, coffee not spilling. Do NOT shrink mug or reduce face features relative to provided reference.
The complete thin note, glasses, bow tie, hands and props turn together coherently. Gentle small yet visible yaw 15-20 degrees and pitch 10-12 degrees, no diagonal roll. Not a thick cube or pillow. Face keeps same gentle OPEN-EYE smile in all nine cells; turn the actual surface, not only pupils.
EXACT READING ORDER: top row up-left, up, up-right; middle row viewer's LEFT, FRONT, viewer's RIGHT; bottom row down-left, down, down-right. All have identical scale, character center and baseline. The left-facing image must face the viewer's left.
Wide clear margins on all four sides in every cell; complete character AND BOTH PROPS contained inside cell, occupy about 65-70% cell dimensions. No clipping, neighbouring cell overlap, touching edges, steam, floating symbols, hearts, stars, labels, floor shadows, ground, watermark or checkerboard. Real alpha transparency. Keep reference likeness rather than invent a new design.

## Reactions prompt

Use case: stylized-concept. Asset type: matching 3x3 REACTIONS sprite atlas for attached coffee-and-pencil MemoCard.
Input1 is nine-direction sprite sheet; Input2 is its exact FRONT center cell and is the canonical drawing to copy. New square PNG with exactly three columns and three rows of equal square cells, transparent background.
Copy Input2 exactly in EVERY cell. Golden-yellow fine felt thin nearly-square sticky note, curled top-right corner, large black round glasses, black brows, black bow tie at lower note edge; viewer-left felt mitten grasps handle of white ceramic mug with brown coffee visible, viewer-right lower mitten holds yellow-orange pencil with pale wood tip, black graphite point and black end cap. ALL NINE DRAWINGS FRONT FACING and identical note, glasses, fold, arms, hands, mug, coffee, pencil and bow tie geometry and positions. Copy non-facial image once; vary only facial features and specified small symbols. Coffee cup always held low and level; no sipping/raising/spilling, no steam. Pencil never moves. Same felt texture, palette, lighting, scale, baseline and prop proportions as canonical front.
Nine expressions in reading order:
1 BLINK: both closed happy arc eyes, small smile.
2 HEART: closed happy arcs and smile, one small red heart floating above note.
3 SPARKLE: closed happy arcs and smile, three small golden sparkle stars above note.
4 SURPRISED: both large round open eyes, raised brows, small round O mouth.
5 WINK: viewer-left eye closed happy arc, viewer-right eye open, playful smile.
6 BASHFUL: gently closed eyes, soft small smile, no pink cheeks.
7 SLEEPY: closed eyes, tiny O mouth, small blue z z z above note.
8 DIZZY: both spiral eyes clearly inside glasses, small wobbly mouth.
9 DELIGHTED: closed happy arcs, open smile with tiny pink tongue.
Wide empty margins around each full character with all objects inside cell, identical clear headroom for tiny heart/stars/zzz. No boundary touches. Character occupies 65-70% cell size, center and baseline identical. Preserve exact likeness of the front reference. No writing lines, shoulders, torso, neck, legs, pedestal, extra props, wave rays, floor shadow, scenery, labels, borders, watermark or painted checkerboard. True alpha transparent background.
