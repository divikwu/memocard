# MemoCard with feet

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

Independent full-body variant based on the user's nine reference images, saved under `references/`. Fine yellow felt note with upper-right fold, large black glasses, viewer-left pencil, viewer-right compact thumbs-up, short legs and rounded yellow feet. No coffee mug, bow tie or bottom fade. Existing coffee and fade variants are preserved.

Built-in image generation produces nine directions and matching nine reactions. Runtime click order follows page-mascot: blink then heart/sparkle/delighted, fourth quick click dizzy. Other reaction cells are surprise, wink, bashful and sleepy. Hand pose, pencil and feet remain fixed between reaction cells so clicking does not jump between gestures.

Rebuild: `build/mascot-tools/bin/python design/mascots/characters/memocard-feet/build.py`. The packer removes export noise and neighbouring-cell fragments, keeps expected floating symbols, uniformly scales the complete figure to 270px height, and aligns the foot baseline at 334px within a 360px cell. No horizontal/vertical stretching.

Runtime atlases: `design/mascots/history/runtime-sheets/memocard-feet-{directions,reactions}.webp`. Raw sheets, front reference and aligned frames stay in this directory.

## Validation

Nine direction cells and nine reaction cells are distinct, on 1080px square atlases with clear transparent margins and complete feet. Both sheets have a visible foot baseline at row 333 in every 360px cell. Left/right cells were cropped and visually checked. The skill verifier reports 0.00px reaction shift at 140px display, 96.3% minimum lower-band silhouette overlap, 85.5% palette match and 7.7% lower-body width difference.

Browser checks passed for all nine pointer sectors, heart/sparkle/delighted/fourth-click dizzy and reset; console is clean. TypeScript, targeted ESLint and diff checks passed. The original coffee and fade variants still render alongside this new version.

## Directions prompt

Use case: identity-preserve. Asset: NEW full-body MemoCard mascot with FEET, nine-direction sprite sheet for cursor tracking.
Image1 is the PRIMARY exact default reference. Image2 shows the same character's expressive felt style, feet and hand anatomy; do not copy its closed eyes or waving pose.
Preserve Image1's naturally thin gently curved nearly-square golden-yellow fuzzy felt sticky-note body, upper-RIGHT physical curled corner, VERY LARGE thick round matte-black glasses, large oval open eyes with white highlights, small black curved brows and closed friendly smile. No writing strokes on the note.
FULL BODY: two short stubby yellow felt legs emerge directly from lower note edge, each ending in a rounded oval yellow felt foot, exactly like references. Visible little gap between legs and feet; legs are short, not human proportions. Feet are complete and crisp, no fading, no blur, no shoes, toes or ground shadow. No neck, shoulders, separate torso, bow tie or coffee mug.
DEFAULT POSE IN ALL NINE CELLS: viewer-LEFT lower hand holds the same yellow-orange pencil with pale sharpened wood, black graphite and black end cap, angled outward/up-left with tip around mouth level. Viewer-RIGHT empty lower mitten makes the same compact friendly THUMBS-UP as Image1 beside its side. Short arms visibly joined to body. Same hand pose and pencil grip across every direction, no waving, no arms raised overhead. Body plus attached hands/pencil/legs/feet are one coherent character.
Nine poses in EXACT reading order: row1 UP-LEFT, UP, UP-RIGHT; row2 viewer LEFT, straight FRONT, viewer RIGHT; row3 DOWN-LEFT, DOWN, DOWN-RIGHT. LEFT means face/glasses/note plane turned toward viewer's LEFT. Keep both eyes and lenses readable. Modest yaw 12-15 degrees, shallow pitch 5-6 degrees. No in-plane diagonal roll/leaning, thick pillow/cube or broad sidewall. Natural gentle thin-note curvature and small edge depth. Feet stay planted on shared horizontal baseline and leg length never changes. Small toe orientation can follow the same yaw; no walking/stepping.
CONSISTENCY: same face and body proportions, unprojected height, pencil size, feet size, center and bottom baseline in all frames. Both eyes stay open and same gentle smile in every cell; direction sheet must not contain expression changes or symbols. Fine felt texture and warm lighting faithfully matching Image1.
Square PNG, EXACT 3 columns x 3 rows equal square cells, WIDE transparent margin on all four sides of every FULL character. Whole figure occupies 64-68% cell height/width, feet/pencil/corner all inside cell with no clipping, no overlap, no ground, no text, no labels, no grid, hearts, stars, rays, watermarks or background. Real alpha transparency, not painted checkerboard.

## Reactions prompt

Use case: identity-preserve. Asset: MATCHING nine-expression sprite sheet for the attached full-body MemoCard WITH FEET.
Image1 is the EXACT GENERATED FRONT drawing: copy that same silhouette, proportions, palette, felt lighting, face-feature scale, hand positions, pencil and feet in EVERY cell. Image2 is the user's heart-expression reference, Image3 is their celebration reference: use only emotional warmth and felt heart/star treatment, NOT their different arm poses or framing.
Square transparent PNG, EXACT 3 columns x 3 rows of equal square cells. All nine characters face straight FRONT, perfectly upright. Reuse the same non-facial drawing once. Note outline, upper-RIGHT folded corner, large round black glasses, left pencil/hand, right compact thumbs-up, short legs and both round yellow feet must be IDENTICAL in shape, size, center and position across all nine.
Identity: naturally thin gently curved golden-yellow fine fuzzy felt square sticky note, very large thick black round glasses, large expressive eyes and small brows/mouth. Lower viewer-LEFT mitten holds short orange-yellow pencil angled outward/up-left with pale wood tip, black graphite and black cap; lower viewer-RIGHT empty mitten maintains compact friendly thumbs-up. Two short yellow felt legs directly under note, two oval yellow felt feet with a visible central gap, feet complete with clear outlines. NO bow tie, coffee, neck, shoulders, separate torso, shoes, ground or fade. Both feet share exact same baseline in all cells. Never move props, wave, lift hands, lift feet, step or alter grip between expressions.
Nine facial reactions in EXACT reading order:
1 BLINK: both eyes closed happy upward arcs inside glasses, small closed smile, no symbols.
2 HEART: same happy arcs/smile, one SMALL RED FELT HEART above note, soft very subtle warm cheek tint as reference.
3 SPARKLE: happy closed arcs/smile, THREE SMALL GOLD FELT SPARKLE STARS above note.
4 SURPRISED: both eyes wide open, raised brows, small round O mouth.
5 WINK: one eye closed, other open, playful smile.
6 BASHFUL: gentle closed eyes, modest small smile and very soft warm cheeks.
7 SLEEPY: peacefully closed eyes, tiny O mouth, SMALL BLUE z z z above note.
8 DIZZY: both eyes drawn as dark spiral swirls inside glasses, tiny wobbly mouth.
9 DELIGHTED: both eyes closed happy arcs, open happy grin with small pink tongue, soft warm cheeks. No large confetti.
Tiny symbols at most 7-8% note height, floating in identical reserved headroom. Same full-character size and baseline in all nine; don't resize or lower figures for symbols. Entire figure about 64-68% cell height with generous clear alpha margins on ALL four sides, including below feet, beside pencil and above heart/stars/zzz. Nothing touches or crosses cell edges.
Fine tactile yellow felt 3D rendering exactly like Image1, black glasses surface and expressive warm feel from references. No writing lines, labels, grid, text except tiny zzz, extra objects, shadows, background, checkerboard or watermark. Real alpha transparency.
