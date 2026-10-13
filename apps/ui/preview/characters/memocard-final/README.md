# MemoCard 最终版

最终造型以用户上传的 reference.png 为准：黄色毛毡便笺、黑色大圆眼镜、闭眼笑脸、画面左侧铅笔、右侧招手、短腿圆脚。保留招手光线，无领结、咖啡或灯泡。

使用内置 image_gen 分别生成九向和九表情透明图。九向正面帧直接使用原图主体；招手光线从原图 alpha 连通区提取后，在全部帧固定坐标合成。只做等比缩放、透明边缘清理与 atlas 打包，不对造型做横纵拉伸。主体高度 270px、脚底 334px；单格 360px，整张图 1080px。

构建：`build/mascot-tools/bin/python apps/ui/preview/characters/memocard-final/build.py`。

运行时素材：`../../mascots/memocard-final-directions.webp`、`../../mascots/memocard-final-reactions.webp`。原有咖啡版、渐隐版、灯泡带脚版保留，最终版单独新增。

## 验证

- page-mascot：点击偏移 0px，轮廓重合 95.6%，色板一致性 86.3%，最大宽度变化 3.5%。
- 18 帧脚底一致为 333px，透明边距大于 8px；左右朝向人工检查通过。
- 浏览器九向跟随、爱心、闪光、开心、快速连续点击转圈眼和表情复位通过，无控制台错误。
- UI typecheck、预览页 ESLint、git diff --check 通过。
- 实际预览截图：`build/verification/mascots/memocard-final-preview.png`。

## Directions prompt

Use case: identity-preserve. Asset: nine-direction interactive mascot sprite atlas. Image1 is the FINAL APPROVED character; reproduce its identity faithfully, not a redesign. Image2 is only a shallow turn/camera guide for the nine directions. Image1 controls material, proportions, face, limbs, clothing, and pose.
Create a 3x3 grid of that exact yellow felt note character: slightly tall rounded square sheet with subtle convex curve, soft moderately thin padded side rim, top-right folded corner; visible fine interwoven felt fiber texture; VERY LARGE black round glasses, two closed cheerful upward-curved eyelids inside the glasses, thick black eyebrows, open happy mouth with small pink tongue. Full body has two short legs and round oval yellow feet. Viewer-left mitten hand holds the orange-yellow pencil with wood tip/black lead and black bottom. Viewer-right arm waves with an open rounded mitten palm, as image1. NO bowtie, no coffee, no lightbulb, no clothing, no body stripes. Preserve original face size and exact relaxed waving hand silhouette.
This is directions only. All nine have identical cheerful CLOSED eye expression and smile as image1. Row1 up-left/up/up-right. Row2 left/front/right. Row3 down-left/down/down-right. Match image2's subtle natural perspective, yaw only10-12 degrees and pitch only4 degrees. Left cells face VIEWER LEFT and right cells face VIEWER RIGHT; DO NOT swap. Do not roll or lean strongly. Keep body face broad, glass lenses nearly equally large, no narrow profile, no thick cuboid side. Soft rim roughly5% of frontwidth. Hands/pencil/feet positions stay stable. The waving palm stays on viewer right and pencil viewer left in every frame.
Do NOT draw the three detached waving rays; original rays will be composited separately at fixed position. Render ONLY the main character and pencil. Full figure centered percell, identical size, levelfoot baseline,75% cell height, generous transparent margins on all sides. Square3x3 sheet, genuinely transparent alpha background, no grid/borders/text/shadow/checkerboard. Match image1's detailed soft woven felt surface and exact large facial elements.

## Reactions prompt

Use case: identity-preserve. Produce the matching nine EXPRESSIONS of the FINAL yellow felt MemoCard character. Image1 is the approved character front view and controls identity and proportions. Image2 is its nine-direction sheet and controls consistent atlas scale. Every expression is straight FRONT facing.
Copy image1's same tall rounded square note, softly curved thin padded rim, top-right fold, visible interwoven felt texture, VERY LARGE black round glasses and large expressive facial elements; short legs and round yellow feet. Viewer-left mitten holds the identical yellow-orange pencil with woodtip and blacklead and blackbase. Viewer-right mitten hand raised to WAVE: open soft rounded three-lobed palm EXACTLY like image1, no pointed finger. Keep hands,pencil,legs,feet in the same position and same size in all nine. Use one identical body across nine and change ONLY facial expression.
3x3 row-major:
0 blink: cheerful curved closed eyelids and small open smile like original.
1 pink/red HEART eyes inside glasses.
2 gold STAR eyes inside glasses.
3 surprise: large glossy black round eyes and open O mouth.
4 wink: one large open glossy blackeye and one curved closed eye, small smile.
5 bashful: large shy eyes glancing down, subtle pink cheeks, small smile; no stripes.
6 sleepy: lowered eyelids and small yawning mouth.
7 dizzy: black spiral eyes inside glasses.
8 delighted: both eyes closed in cheerful curves, broader open laughing mouth.
Preserve exact large glasses, pencil and waving hand, shape/thickness/proportions. No bowtie, no clothing, no coffee cup, no lightbulb, no body lines. No detached symbols or waving rays: exact source rays added separately. 3columns3rows, square actual alpha transparent canvas, character75% cell height, fullfeetshown, identical size and baseline, clear empty margin. No text/border/checkerboard/drop shadow/background. Keep soft woven felt instead of smooth plastic.
