# MemoCard matching reaction sheet

Generated with the built-in image generation tool, matching the corrected three-direction note/hand/pencil design. Runtime order: blink, heart, sparkle, surprised, wink, bashful, sleepy, dizzy, delighted. The existing page-mascot component selects blink followed by heart/sparkle/delighted on successive clicks, and dizzy after four quick clicks.

The sheet is saved as `three-reactions.png` and packed by `build-three-directions.py` into `design/mascots/history/runtime-sheets/memocard-three-reactions.webp`. Reactions are anchored on the largest connected character silhouette so floating symbols do not move the character. A shared smaller scale provides icon headroom, and crop-edge fragments from neighbouring source cells are removed.

Validation: the page-mascot skill's `verify.py memocard-three` reports 0.00px reaction shift, 97.7% minimum silhouette overlap, 85.0% palette match and 11.3% lower-body width difference (the directions include whole-body yaw). All nine atlas cells contain distinct art. Browser clicks verified blink → heart, blink → sparkle, blink → delighted, then dizzy on the fourth quick click; reactions reset afterwards, and Enter also triggers them. Reloaded console is clean. TypeScript, targeted ESLint and `git diff --check` passed.

## Prompt

Use case: stylized-concept. Asset type: production transparent 3x3 reactions sprite atlas matching the approved MemoCard three-direction sample.
Reference roles: image1 is the EXACT aligned front-facing pose to match. Image2 is the higher-resolution three-direction strip; use only its MIDDLE front pose for surface detail and identity.
Make a square 3 columns x 3 rows sheet, EXACTLY nine equally-sized cells, of the SAME full front-facing character. Every cell copies the identical base note silhouette, glasses frames, physical upper-right folded corner, two LOWER side-attached hands, short felt arm connections, yellow pencil in viewer-right hand, and black bow tie at lower center. All cells face FRONT, same note size and same vertical/horizontal position.
Identity: broad golden-yellow fine plush felt sticky note, softly rounded corners and thin side edge, large thick round matte-black glasses, dark expressive oval eyes, gentle black smile, small relaxed eyebrows. Clean yellow face with NO horizontal writing lines. No shoulders, neck, legs or pedestal. Hands stay low by the side edges, smaller mittens visibly attached with short arms; pencil held low on viewer's right with tip near mouth level. Same exact pencil design (orange-yellow body, pale wood cone, black graphite tip, black bottom cap), grip, bow tie shape, lighting, texture and palette as references.
CRITICAL: Draw the non-facial character ONCE and reuse it identically for every cell. The note outline, folded corner, glasses, hands, arms, pencil and bow tie MUST NOT change geometry, scale or position. Only the eyes, eyebrows and mouth change plus the tiny symbols explicitly listed. Do not raise hands or move the pencil in any reaction. Preserve the calm default front pose's body geometry precisely.
Nine expressions in reading order, corresponding to runtime indices:
1. BLINK: both eyes closed as soft happy arcs inside glasses; small closed smile.
2. HEART: same closed arc eyes and smile; ONE tiny red heart above note.
3. SPARKLE: same closed arc eyes and smile; THREE tiny golden sparkle stars above note.
4. SURPRISED: open round eyes, relaxed raised eyebrows, small O mouth.
5. WINK: one eye softly closed, other open, small playful closed smile.
6. BASHFUL: both eyes softly closed, modest closed smile and relaxed brows, NO pink blush.
7. SLEEPY: relaxed closed downward eye curves, tiny O mouth, small blue z z z above note.
8. DIZZY: two spiral eyes behind glasses, small wobbly mouth.
9. DELIGHTED: closed happy arc eyes, a joyful open grin with small pink tongue.
Layout: equal square cells, character complete and contained, wide empty margins. Keep all nine body baselines fixed. Characters occupy at most 68-70% cell height. Reserve equal generous empty headroom in EVERY cell; do not shrink or lower a character to accommodate symbols. Floating heart/stars/zzz are TINY, each group at most 8% of note height, floating just above the note and fully inside its cell. Nothing touches or crosses a cell edge.
Soft tactile felt 3D rendering exactly like references; no restyling, no flat outline cartoon. No labels, grid lines, background, ground shadows, watermark, props other than the existing pencil. No tears or extra exterior symbols. Real alpha-channel transparent PNG, no painted checkerboard. Square canvas, high resolution.
