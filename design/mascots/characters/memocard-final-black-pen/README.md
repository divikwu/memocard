# MemoCard 黑笔最终版

归档源资料：以下设计过程和验证记录保留原发生时语义，不作为本轮验收。现行角色、构建输出与预览入口见[素材总览](../../README.md)。

以用户上传的 reference.png 为最终形象：黄色毛毡便笺、黑色大圆眼镜、闭眼笑脸、粉色腮红、画面左侧黑银色笔、右侧招手和圆脚。默认正面直接使用原图主体，招手光线也从原图透明通道提取。

侧边与朝向以用户明确指定的 directions-reference.png 为准，在内置 image_gen 中只替换铅笔和增加腮红；保留参考图的薄曲面和各朝向。素材制作使用内置 image_gen，透明背景，无 API/CLI 回退。

九个表情依次为眨眼、爱心、星光、惊讶、眨单眼、害羞、困倦、转圈眼、开心。保留黑银色笔、腮红、招手、短腿圆脚。原图光线在全部帧固定坐标叠加。

构建：`build/mascot-tools/bin/python design/mascots/characters/memocard-final-black-pen/build.py`。主体等比缩放至 270px 高，脚底 334px，单格 360px，整张 atlas 1080px；不做横纵非等比拉伸。

素材：`apps/ui/mascot-fixtures/memocard-final-black-pen-directions.webp`、`apps/ui/mascot-fixtures/memocard-final-black-pen-reactions.webp`。预览中单独新增，保留铅笔最终版。

## 验证

page-mascot 实测点击偏移 0px、轮廓重合 91.7%、色板直方图重合 59.8%、宽度差 2.5%。18 帧脚底均为 333px，透明边距大于 8px。九向左右人工检查，右转侧边与用户指定的铅笔参考图对比检查。色板数值反映素材仍有明暗和纹理差异，不等同于原图像素完全一致。

浏览器九向鼠标跟随、爱心、星光、开心、连续点击转圈眼及复位通过，无控制台错误。UI typecheck、预览页 ESLint、git diff --check 通过。实际右转对比截图：build/verification/mascots/memocard-black-pen-right-comparison.png。

## Reactions final color edit prompt

Use case: lighting-weather. Image1 is the EDIT TARGET: an already-correct 3x3 expression atlas. Keep EVERY figure's silhouette, pose, perspective, hands, feet, pen, face geometry, expression, proportions, position, and all nine cell contents EXACTLY unchanged. Only match the golden yellow felt COLOR and warm studio lighting to image2. The previous expression sheet is slightly brighter/more lemon yellow than the approved image2. Match image2's warm golden yellow, detailed fiber feel and subtle shading while keeping the same drawings and the same front-facing pose. Do not reinterpret or rotate any figure. Do not change facial expressions. Do not change the black silver pen or cheek blush. No new objects or rays. Preserve exact square3x3 layout and true transparent alpha background. This is a local palette/light correction only, not regeneration of a character or new pose.

## Directions prompt

Use case: precise-object-edit. INPUT1 IS THE EDIT TARGET AND ITS NINE FIGURES MUST STAY EXACTLY AS DRAWN. The user explicitly approved INPUT1's side geometry and REJECTED a previous redraw of thick straight side panels. Perform ONLY two local changes in INPUT1:
1. Replace each of the nine orange/yellow pencils with the black-and-silver writing pen shown in INPUT2. Keep each pencil's existing screen location, angle, length and hand grip unchanged. Pen has black cylindrical barrel, black rounded ends, silver bands at both ends and a silver pocket clip. It is a pen, not a pencil. Hand occludes pen correctly. Preserve original arm and mitten pose.
2. Add soft peach-pink circular cheek blush as INPUT2 without changing the facial geometry.
LOCK ALL OTHER PIXELS / GEOMETRY AS CLOSELY AS POSSIBLE: preserve INPUT1's nine individual body silhouettes, exact gentle yaw and pitch, thin rounded curved felt side rim, top-right folded corner shapes, camera angle, body width/height, glasses size/position, CLOSED happy eyelids, mouth, raised wave hand and round feet. Preserve all nine poses and their exact location in their cells. Do not redraw or reinterpret the body. Especially right column figures MUST retain input1's thin softly curved LEFT SIDE EDGE, not a straight thick upright panel and not a box bevel. Copy that contour exactly. No new thickness, no larger perspective, no new posture, no scaling.
Image2 provides ONLY the pen design and blush. Do not copy its larger body or pose. No bulb,bowtie,clothing,coffee. No detached waving rays, since production adds original rays. Preserve square 3x3 transparent sprite sheet layout of input1. Actual transparent alpha, no grid,borders,text,shadow or checkerboard. Local prop swap and blush ONLY.
