# memocard-wink

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Independent reference-based variant generated with the built-in image generation tool, using the page-mascot workflow. Viewer-left raised mitten, viewer-right pencil, default wink. Existing characters are preserved.

Source reference, raw sheets, prepared sheets and front reference are saved here. Runtime assets are served from `design/mascots/history/runtime-sheets/memocard-wink-{directions,reactions}.webp`.

The whole note with attached hands and props rotates as one character. Use content anchoring and no bust vignette. Build with the local `build/mascot-tools/bin/python`, the skill's `build.py memocard-wink --anchor content --no-vignette`, and `MASCOT_ROOT=design/mascots MASCOT_DEST=design/mascots/history/runtime-sheets`. Run local `prepare.py` first, then skill `verify.py memocard-wink`.

## Validation

Skill verifier: 0.00px reaction shift at 140px display size, 97.0% minimum lower-band silhouette overlap, 76.4% palette match, 5.3% lower-body width change. Both atlases are 1080 square with nine distinct 360px frames and clear cell-edge margins. Left/right cells were cropped and visually checked.

Browser: all nine pointer sectors, heart/sparkle/delighted/fourth-click dizzy, reset and Enter activation passed for both variants. The 375px layout has no horizontal overflow and the test console has no errors. TypeScript, targeted ESLint and diff checks passed. Existing original and greeting atlas hashes are unchanged.

## Directions prompt

Use case: stylized-concept. Asset type: production 3x3 DIRECTION sprite sheet for page-mascot, derived faithfully from the attached single reference.
Make exactly NINE full-character drawings on a square transparent PNG, evenly spaced in three columns and three rows of equal square cells. There will be a matching reactions sheet next.
IDENTITY LOCK: keep this exact yellow plush felt sticky-note character: broad near-square flat thin note, gently rounded edges, physically curled top-right corner, VERY LARGE thick black round glasses and expressive large eyes, black curved eyebrows, small curved smile, black bow tie at the bottom directly on the note. Keep fine golden felt texture, black softly satin glasses and bow tie, same yellow and warm studio lighting. Clean face with NO writing lines. No torso, neck, shoulders, legs or pedestal.
POSE LOCK: viewer-left hand is raised beside the left edge in this reference's friendly simple mitten waving pose, short arm visibly joined to note. Viewer-right hand is lower holding the exact same yellow-orange pencil with black cap, pale sharpened wood and black graphite point, angled upward. Keep both hands, grip, pencil scale/angle and bow tie consistent across all nine frames.
EXPRESSION LOCK: keep the reference's one-eye wink and smile in EVERY direction: viewer-left eye closed happy arc, viewer-right eye open, same eyebrows. No additional symbols.
The complete thin note and attached hands and pencil turn together, rather than a head above a fixed torso. Rotate subtly but clearly, yaw about 15-20 degrees and pitch about 10-12 degrees. No diagonal roll, no cube thickness, both lenses readable, don't merely shift pupils.
EXACT CELL ORDER: row1 up-left, up, up-right; row2 viewer's LEFT, straight FRONT, viewer's RIGHT; row3 down-left, down, down-right. Looking left must point the face to the viewer's left. Identical scale, center and baseline in all cells.
MARGINS: draw whole character at 65-70% cell width/height, WIDE EMPTY GAP on every side, no hand, pencil, bow tie or corner touching any boundary. Keep centered in every cell. True alpha background, no scenery, floor shadow, checkerboard, labels, text, hearts or sparkles. Preserve reference appearance and proportions; don't restyle into cartoon line art.

## Reactions prompt

Use case: stylized-concept. Asset type: matching 3x3 REACTIONS sprite sheet for the attached MemoCard wink-and-wave character.
Input1 is the generated nine-direction sheet; Input2 is its EXACT FRONT center cell. Copy Input2's character, pose, palette and scale in every cell of a new 3-column by 3-row square transparent sprite sheet. Use identical full-character silhouette and layout in all nine cells, all facing straight FRONT, no yaw or tilt.
Identity: warm yellow fine plush felt thin square note, curled top-right corner, very large thick black round glasses, black eyebrows, small expressive mouth, black bow tie directly at bottom. Viewer-left mitten raised beside the note, viewer-right lower mitten holding the same diagonal yellow-orange pencil with black tip and black cap. KEEP RAISED HAND, LOWER GRIP, PENCIL, NOTE SHAPE, FOLD AND BOW TIE in EXACT SAME POSITION AND SCALE across all cells. Reuse non-facial drawing, change only eyes/brows/mouth. No writing strokes, shoulders, torso, neck or legs.
Nine expressions in reading order:
1 BLINK: both eyes closed as happy upward arcs, small smile.
2 HEART: both happy closed arcs and smile, one SMALL RED HEART above the note.
3 SPARKLE: happy closed arcs and smile, THREE SMALL GOLD SPARKLE STARS above the note.
4 SURPRISE: both large open eyes, raised eyebrows and a small O mouth.
5 WINK: same wink as input center, viewer-left eye closed arc and viewer-right eye open, relaxed smile.
6 BASHFUL: soft closed eyes, gentle modest smile, NO blush.
7 SLEEPY: closed eyes and tiny O mouth, tiny blue z z z above the note.
8 DIZZY: both eyes visible as dark spirals inside glasses, small wobbly mouth.
9 DELIGHTED: closed happy arcs, open happy grin and tiny pink tongue.
Reserve equal headroom above every character for tiny symbols (at most 7% character height). Whole character at 65-70% cell size with WIDE transparent margins all sides, no clipping or touching boundaries. Match front reference proportions, felt rendering, lighting, large glasses, exact prop shapes and baseline. True alpha transparency, no painted checkerboard, floor shadows, borders, labels, writing lines, waving rays or extra props.
