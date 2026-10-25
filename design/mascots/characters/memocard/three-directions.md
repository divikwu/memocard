# MemoCard three-direction sample

Generated with the built-in image generation tool using concept-v5.png as the approved identity reference. The complete note, hands, pencil and bow tie turn together. This sample has left, front and right poses only; vertical aim reuses the horizontal poses. The matching nine-expression sheet is described in `three-reactions.md` and restores the page-mascot component's standard click reactions.

Hand placement was subsequently refined using the prompt in `three-directions-hands.md`: lower side attachments, smaller mittens and a lower pencil grip. Aligned heights are 274/271/271px at a common 360px tile size (less than 1.2px difference at 140px display), with shared headroom for the reaction icons. TypeScript and targeted ESLint checks passed.

## Build

Run `build/mascot-tools/bin/python design/mascots/characters/memocard/build-three-directions.py` from the repository root. The script uses a common scale, centered silhouette and shared bottom baseline rather than the shoulder anchor used by bust mascots. Source strip: `three-directions.png`; aligned frames: `three-left.png`, `three-front.png`, `three-right.png`; runtime atlases: `design/mascots/history/runtime-sheets/memocard-three-{directions,reactions}.webp`.

## Prompt

Use case: stylized-concept. Asset type: three-direction transparent production sprite strip for an interactive web mascot.
Attached image is the APPROVED MemoCard calm-default design. Reproduce the exact same character identity, proportions, yellow plush felt, big black round glasses, open dark oval eyes with modest white highlights, relaxed eyebrows, closed gentle smile, upper-right folded note corner, two mitten-like hands, yellow pencil held on viewer's right, and black bow tie at the lower center.
Create exactly THREE full character drawings arranged in ONE evenly spaced horizontal row of THREE EQUAL SQUARE CELLS. Wide landscape canvas with aspect ratio 3:1, ideally 1536x512. No grid lines or labels. Each complete character fills about 70-74% of its own square cell height with generous actual transparent margin on all four sides. Every hand, pencil and folded corner entirely inside its cell.
Left cell: the ENTIRE note character turns slightly toward viewer's LEFT, yaw about 15-20 degrees, eyes calmly looking left. The face plane and glasses point LEFT. No pitch or roll.
Middle cell: exact front-facing calm-default reference character, looking forward.
Right cell: the ENTIRE note character turns slightly toward viewer's RIGHT, yaw about 15-20 degrees, eyes calmly looking right. Face plane and glasses point RIGHT. No pitch or roll.
This is a THIN sticky-note character: front is broad and nearly planar with soft fine felt, sidewall only about 5% of its front width. Only a narrow side edge is visible in turned views. No puffy cube thickness.
IMPORTANT: this mascot is ONE complete note shape with hands/pencil/bow tie attached, without separate neck, shoulder pedestal, torso or legs. The whole note gently rotates as a single coherent object; hands and pencil move naturally with it. Keep hand pose and pencil grip identical in all three states, do not wave, change hands, lengthen pencil, switch sides, change fold corner or invent parts. The same physical upper-right corner stays folded. In each view keep both lenses and both eyes readable.
Match scale across all three drawings: same unprojected note dimensions, same apparent overall height, same center and bow tie baseline within each square cell. Stable centered pivot around the note's central face. No drifting up/down. Same exact expression and lighting in all three cells; only facing direction changes.
Face is clean golden-yellow, no writing lines, lettering or text. No tears, surprise rays, hearts or floating symbols, no pink blush. Do not make facial elements smaller than reference. Preserve black bow tie size and pencil design (yellow-orange body, pale sharpened wood, black graphite tip and black end cap). Soft warm studio illumination, tactile fine felt, clear readable edges, identical palette/rendering in every cell. No backgrounds, ground shadows, borders, labels or watermarks. Genuinely transparent PNG with real alpha, no painted checkerboard.
