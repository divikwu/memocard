# MemoCard mascot

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Generated with the built-in image generation tool from the user-provided MemoCard IP. Final direction: thin felt note head, clean face with no writing strokes, round black glasses, folded upper-right corner and black bow tie. Arms and pencil are omitted for the interactive bust.

Source PNGs and final WebP atlases are kept in `design/mascots/characters/memocard` and `design/mascots/history/runtime-sheets`. Faint export noise at alpha ≤ 2/255 was cleared before packing. Build with the page-mascot skill's `build.py memocard --anchor shoulders --no-vignette`, setting `MASCOT_ROOT` to `design/mascots` and `MASCOT_DEST` to `design/mascots/history/runtime-sheets`. The complete bust uses no bottom fade so the bow tie stays visible. Run `verify.py memocard` with the same environment to check alignment.

Final verification at 140px: 0.00px maximum reaction shift, 96.7% minimum body overlap, 86.4% palette match and 2.2% shoulder-width difference. Browser checks passed for all eight pointer directions, click and Enter reactions, and a 375px layout without horizontal overflow. TypeScript and targeted ESLint checks passed.

## Directions prompt

Use case: stylized-concept. Asset type: production 3x3 direction sprite sheet, PNG with actual alpha.
Reference roles: Image 1 is the previous direction sheet to revise, retaining character identity and sprite grid. Image 2 is the original MemoCard IP, preserving its yellow felt, round black glasses, folded note corner and black bow tie. Image 3 is a UI screenshot: use ONLY the highlighted Gearbot to understand THIN SLAB HEAD DEPTH. Ignore the screenshot UI and all other characters.
Create the revised 3x3 sheet of NINE head directions. Two required changes in EVERY CELL: (1) completely remove the three ochre horizontal writing strokes below the mouth, replacing them with clean yellow felt; (2) make the sticky-note head a genuinely THIN felt-covered NOTE CARD, with a broad nearly planar front and depth ONLY 5-7 percent of its width. In three-quarter views only a very narrow side edge is visible, comparable to the Gearbot thin slab construction. No swollen pillow, thick block, cube or protruding bulging cheeks. Front-facing head keeps its broad rounded-square outline and natural width-to-height ratio, not vertically squashed. Slightly softened rounded edges, but the broad face remains nearly planar. Keep the gently curled upper-right paper corner.
Preserve adorable warm golden-yellow plush felt material, subtle tactile fibers, large dark open eyes with white catchlights behind thick round matte black glasses, small friendly smile, folded physical upper-right corner, and black bow tie. Soft warm diffuse lighting, high quality tactile 3D character. No writing lines, strokes, letters or symbols anywhere on the note.
A short narrow golden-yellow felt chest/shoulder pedestal below the note carries the black bow tie. BODY MUST BE IDENTICAL IN ALL NINE CELLS: reuse exactly the same forward-facing shoulder pedestal and black bow tie at precisely the same width, height and position. Body width about 2/3 of front-view head width. Only the thin note head turns above it.
Layout: square 3x3 grid of exactly nine equal square cells, evenly spaced. Wide transparent margins on all four sides of EVERY cell. Entire bust occupies only 65-70 percent cell height. Nothing touches a cell edge. No cell borders, labels, backgrounds, ground shadows, hands, arms, legs, pencil or floating symbols.
Same open-eye calm friendly face in all nine cells. Head itself clearly rotates, glasses track the flat face plane. Moderate 25-35 degree yaw and 15-20 degree pitch with thin sidewall visible only as a narrow edge.
Reading order: row 1 up-left, up, up-right; row 2 left, straight at viewer, right; row 3 down-left, down, down-right. Left is viewer's LEFT, right is viewer's RIGHT. No roll/diagonal leaning: the head turns toward the direction but its vertical axis is stable. All nine heads share same scale. The glasses and folded corner remain recognizable at every angle.
Real alpha transparency, no painted checkerboard. Match canvas size and maintain precise fixed body geometry; a matching expression sheet will follow.

## Expressions prompt

Use case: stylized-concept. Asset type: transparent 3x3 expressions sprite sheet matching the attached direction atlas.
Attached image is the APPROVED nine-direction sheet. Use its MIDDLE CELL (row2 col2) as the exact base pose, and duplicate that SAME front-facing mascot NINE TIMES. The only variations are eyes, mouth and the small symbols listed below.
Character: golden-yellow felt THIN sticky-note head with broad nearly planar rounded-square front, thin narrow side edge only 5-7% of head width, physical upper-right folded paper corner, thick round matte-black glasses, large expressive eyes, tiny mouth; short narrow yellow felt chest/shoulder pedestal with black bow tie. Preserve the approved tactile plush/felt 3D rendering, warm palette and soft lighting EXACTLY.
There are NO ochre horizontal writing lines anywhere on this character: ALL the yellow face below the mouth is perfectly blank. No writing strokes, no text, no marks on the head.
Match middle reference cell's EXACT front-facing note head width, height and position; same glasses frame, fold, surface texture, pedestal and bow tie. Do not make a puffy block. All nine heads face straight forward with NO tilt. EVERY HEAD OUTLINE AND GLASSES FRAME IS THE SAME. Draw once and reuse across cells.
MOST CRITICAL: reuse the EXACT same shoulder/chest/bow-tie body geometry and pixels as reference center pose in EVERY new cell. Identical width and vertical position at the bottom. Do not shrink, widen or move body to fit symbols. All nine character busts must have IDENTICAL scale and position within equally-sized cells. Hearts/stars/zzz belong in empty space above the fixed head; their presence MUST NOT change head/body scale or height. Keep space between all symbols and cell edges.
Exactly square 3-column x 3-row grid on actual alpha-channel transparency, same image dimensions as reference, evenly spaced square cells, wide empty margins. No panel lines, labels, scenery, shadow beneath bust, arms, hands, legs or pencil. Whole bust stays inside cell.
Nine expressions in reading order:
1. Blink: eyes closed as upward happy arcs, gentle smile, no symbol.
2. Love: same closed happy arcs and smile, one tiny clearly visible red heart above head.
3. Sparkles: same closed happy arcs and smile, three tiny golden sparkle stars above head.
4. Surprise: wide round open eyes, small O mouth.
5. Starstruck: two star-shaped eyes visible behind glasses, joyful smiling mouth.
6. Blush: closed happy arc eyes, tiny smile, pink cheek blush.
7. Sleep: relaxed closed eye curves, tiny O mouth, small blue z z z above head.
8. Dizzy: spiral eyes behind glasses, wobbly mouth.
9. Laugh: closed happy arc eyes, wide open happy grin.
IMPORTANT: leave cheek/mouth changes local; keep every other head detail and body pixel unchanged. Same transparent background, no painted checkerboard. Clean consistent aligned sprite atlas, high quality felt texture.
