# MemoCard greeting mascot

An independent greeting variant generated with the built-in image generation tool. Its default pose raises the viewer-left mitten to greet while the lower viewer-right hand holds the pencil. It has nine directions and nine reactions. The existing `memocard-three` variant remains unchanged.

Raw generated sheets are kept as `directions.raw.png` and `reactions.raw.png`. `prepare.py` removes faint export noise and neighbouring-cell fragments, preserves the expected floating reaction symbols, and adds cell margins. Run it with the local mascot-tools Python, then use the page-mascot skill's `build.py memocard-wave --anchor content --no-vignette` with `MASCOT_ROOT=apps/ui/preview` and `MASCOT_DEST=apps/ui/preview/mascots`. The content anchor suits a complete note with attached hands; the whole character turns rather than a head above fixed shoulders. Check alignment with the skill's `verify.py memocard-wave`.

Runtime atlases: `preview/mascots/memocard-wave-directions.webp` and `preview/mascots/memocard-wave-reactions.webp`.

Validation: the skill's `verify.py` reports 0.00px reaction shift, 96.4% minimum silhouette overlap, 57.3% palette match and 10.0% lower-body width difference. Both atlases contain nine distinct frames without visible edge clipping. Browser checks passed for all nine directions, blink → heart/sparkle/delighted, the fourth-click dizzy reaction, reset and Enter activation. The 375px page has no horizontal overflow, and the reloaded console is clean. TypeScript, targeted ESLint and diff checks passed. SHA-256 checks confirm both existing `memocard-three` atlases are unchanged.

## Directions prompt

Use case: stylized-concept. Asset type: NEW independent MemoCard greeting-gesture mascot, production 3x3 DIRECTION sprite sheet with real alpha transparency.
Reference roles: Image1 is the approved current MemoCard character with low hands/pencil; use its exact identity, open-eye facial proportions, texture, palette and no-writing-lines face. Image2 is a greeting-pose reference ONLY: use its raised waving hand on viewer's left. Ignore its three writing strokes and external waving marks.
Create NINE full-character poses of a separate "MemoCard Greeting" variant. Warm golden-yellow fine plush felt rounded-square thin sticky note, large matte-black round glasses, large dark calm OPEN eyes with small white highlights, relaxed small eyebrows, gentle closed smile, curled physical upper-right corner, black bow tie directly at note's lower center. No neck, shoulders, torso, legs or pedestal.
DEFAULT GREETING POSE IN EVERY CELL: the viewer-left felt arm is visibly connected to the note's left side and bends upward into a raised friendly waving mitten beside the left edge of the face, palm facing viewer. Keep a simple soft mitten silhouette, no detailed human fingers. A small clear gap between raised hand and glasses; do not cover face. The viewer-right hand stays LOWER at the right side holding the same short yellow-orange pencil with pale sharpened wood cone, black graphite tip and black end cap, angled diagonally upward. Keep the wave gesture held as the default pose in ALL nine directions. Do not lower it in some cells, do not switch waving/gripping hands.
The COMPLETE thin note, raised waving arm/hand, lower pencil hand, pencil and bow tie gently rotate together as one coherent character. All nine poses share the SAME pose, hand proportions, grip, pencil length, head/body dimensions and lighting. Keep the exact scale, character centre and bow-tie baseline consistent within all nine cells. Only orientation changes; same calm open-eye smiling expression in every cell.
Turn directions, in reading order: row1 up-left, up, up-right; row2 left, FRONT, right; row3 down-left, down, down-right. Left means viewer's LEFT and right viewer's RIGHT. Moderate small rotations (yaw about 15-20 degrees, pitch about 10-12 degrees), no diagonal roll/leaning, both glasses lenses stay readable. The head is a thin felt-covered NOTE SLAB, side edge only around 5% of note width, nearly planar front and softly rounded rim, no thick pillow/cube.
LAYOUT: square PNG, exactly 3 columns x 3 rows of equally sized square cells. Entire character, waving hand and pencil completely INSIDE its cell with wide transparent margins. Character occupies only 66-70% cell width/height, leaving plenty of empty space on all sides. Do not let hand, bow tie, pencil or fold touch any cell boundary.
Fine tactile golden felt 3D rendering matching image1. No three horizontal writing lines, no text, no blush, no floating wave/ray marks, hearts, stars, tears or other symbols in this direction sheet. No ground shadows, borders, labels, scenery or watermark. Actual transparent background with a real alpha channel, not a painted checkerboard.

## Reactions prompt

Use case: stylized-concept. Asset type: MATCHING transparent 3x3 REACTIONS sprite sheet for the attached approved "MemoCard Greeting" front pose.
The attached image is the EXACT canonical front-facing drawing to copy in ALL nine cells. Keep the SAME warm golden-yellow fine plush felt thin rounded-square note, top-right curled corner, large round black glasses, black bow tie, raised viewer-left waving mitten with its short side-connected arm, and lower viewer-right hand holding the same yellow-orange pencil with pale wood cone, black tip and black end cap.
This variant's DEFAULT gesture is the raised waving hand. CRITICAL: KEEP THAT HAND RAISED IN ALL NINE EXPRESSIONS. Every hand, arm, pencil, bow tie, note silhouette, glasses frame and folded corner must be the exact SAME shape, size and position in all cells, matching the reference. Copy the non-facial drawing once and reuse it. No lowering, waving motion between cells, moving pencil, switching hands or changing props. All characters face FRONT. Only eyes, brows and mouth change, plus tiny symbols explicitly specified below.
Nine expressions in reading order:
1 BLINK: closed happy arc eyes behind glasses, small closed smile.
2 HEART: same closed happy arcs and smile, one TINY red heart above note.
3 SPARKLE: same closed happy arcs and smile, three TINY golden sparkle stars above note.
4 SURPRISED: wide round open eyes, raised relaxed brows, small O mouth.
5 WINK: one eye closed, other open, gentle playful smile.
6 BASHFUL: closed soft eyes, modest small smile, relaxed brows, no pink blush.
7 SLEEPY: peacefully closed eyes, tiny O mouth, TINY blue z z z above note.
8 DIZZY: spiral eyes behind glasses and a small wobbly mouth.
9 DELIGHTED: closed happy arc eyes and an open happy grin with tiny pink tongue.
LAYOUT: square transparent PNG, EXACT 3 columns x 3 rows of equal square cells. Identical scale, centre and bottom baseline in all nine cells. Reserve WIDE EMPTY MARGINS on all four sides including around the raised waving hand and pencil. Each full character occupies only 64-68% of its cell height and at most 76% of width. Reserve equal empty headroom in every cell; symbols float above the head and stay entirely inside the cell. Symbols are small, no more than 7% of note height. Do not shift or resize characters to make room for them.
Preserve the reference's tactile dense fine felt 3D rendering, warm gold palette, matte-black glasses and bow tie, and exact front pose. Face clean yellow with NO horizontal writing lines or text. No neck, shoulders, torso, legs, pedestal, tears, pink blush or extra objects. No floating waving rays, labels, borders, ground shadows, backgrounds or watermark. Actual alpha transparency, no painted checkerboard.
