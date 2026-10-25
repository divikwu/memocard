# MemoCard 带脚灵感版

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

以用户提供的灵感角色保留铅笔、右手指向上方、圆脚与灯泡；以现有 MemoCard 九向图为朝向、薄曲面厚度及自然姿态参照。不增加领结。

生成方式：内置 image_gen，透明背景。方向图和表情图分别生成。原图灯泡、光线、星光按 alpha 连通区提取，在全部 18 帧同一坐标合成，避免装饰形变。手和脚均使用生成图原有造型，不做横纵非等比拉伸。以主体高度 250px 和脚底 334px 统一打包至 360px 单格。

运行 `build/mascot-tools/bin/python design/mascots/characters/memocard-idea/build.py`，输出位于 `apps/ui/mascot-fixtures/memocard-idea-{directions,reactions}.webp`。旧带脚版本保留在相邻目录。

page-mascot 验证：点击偏移 0px，轮廓重合 96.6%，色板一致性 79.9%，最大宽度变化 5.3%。九向图左右人工检查；前一版反向图未启用。

浏览器验证：九向鼠标跟随、爱心、闪光、开心及快速连续点击转圈眼通过，无控制台错误。18 帧脚底均为 333px、透明边距大于 8px。UI typecheck、预览页 ESLint 与 git diff --check 通过。预览截图：build/verification/mascots/memocard-idea-preview.png。

## Directions prompt

Use case: precise-object-edit. INPUT 1 is the approved MemoCard nine-direction atlas and is the AUTHORITATIVE source for direction, camera angle, slab thickness, curved edges, note proportions, silhouette, face size, and natural relaxed posture. INPUT 2 is the new idea mascot and is authoritative ONLY for: short legs/feet, viewer-left pencil and viewer-right raised index pointing upward, happy open smile, no bow tie. Produce a 3x3 nine-direction atlas that looks like INPUT1's MemoCard with those substitutions.
CRITICAL: match each input1 cell's exact direction and perspective one-to-one. Row1 upper-left/up/upper-right; row2 left/front/right; row3 lower-left/down/lower-right. Use input1's very shallow, soft rounded slab thickness and curved face, not the thicker brick from input2. Do NOT reverse left/right. All body faces stay wide, no profile or strong turn. Match input1's large glasses and large eyes relative to note, eye direction and gentle camera pitch. Match input1's upright relaxed posture and stable baseline. Uniform size between cells. Change only: remove bow tie and coffee mug entirely, add two short yellow felt legs and oval feet from input2, change viewer-right hand into raised pointing index as input2; keep viewer-left pencil. SAME hands fixed, SAME pencil and feet size, SAME yellow shade and fine felt texture across nine. Do not invent a costume or neck. All nine happy eyes open and small open smile. No floating bulb, rays or stars rendered here; these exact original decorations are composited separately. No new design, no shoulder stand, no thick cuboid.
Square transparent alpha canvas 3x3 cells. Each complete character occupies75% cell height with clear padding, allfeet fullyshown. No borders/text/checkerboard/background or drop shadows. Keep body size, thickness and natural posture consistent with input1.

## Reactions prompt

Use case: identity-preserve. The attached character is the APPROVED front view. Produce a MATCHING 3x3 facial expressions sprite sheet, copy its exact proportions, soft thin curved note thickness, upright natural pose, large glasses and eye size, yellow felt texture, folded corner, left hand pencil position, right raised index pointing position, short legs and feet positions. No redesign. All nine perfectly front-facing, all bodies,hands,pencils,feet identical position and size, only facial features change.
Row-major nine expressions: blink; pink heart-shaped eyes; golden star-shaped eyes; surprised; wink; bashful; sleepy; spiral dizzy eyes; delighted closed happy eyes and open smile. Keep symbols INSIDE glasses, no detached reaction decorations. Soft blush for bashful, no cheek stripes. No bowtie, coffee, clothing, new limb pose or body lines. Keep thin soft rim from reference; no thick block. The bulb will be overlaid separately from original source, do not render bulb or rays or stars outside glasses.
3 columns x3rows on square transparent alpha canvas. Entire character fits within each cell at75% cell height, clear empty margin on all four sides, consistent baseline and identical scale. No borders labels text shadows checkerboard or backdrop. Copy exact supplied front view geometry, do not shrink the face or enlarge head/feet.
