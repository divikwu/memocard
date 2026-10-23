# 卡片与列表业务配方复核

2026-10-23。用户明确要求集合UI复刻旧版业务实现，并继续使用新版token/components。本轮只改 `ui-next/business/NoteCollection.tsx`、`NoteCollection.css` 和对应focused tests；未改旧src、共享NoteMarkdown/NotePreview/note-content.css、数据controller、路由、字体或圆角偏好。任务checkbox图形由Root在共享非交互Markdown路径恢复，未重复绘制。

## 旧实现依据与本轮对齐

| 项目 | 旧真实源码 | 新版局部处理 |
| --- | --- | --- |
| 布局种类 | `note-collection-layout.ts` 只定义cards/list；共享useCollectionLayout保存两个独立key | 保留cards/list、主页独立偏好；没有新增masonry功能。旧cards为固定高度grid，并非瀑布流。 |
| 列宽/卡高 | `collectionClasses()` 最小列320px、gap16、固定h-64=256px | 保持同一320/16/256规则；窄容器自动1列。源码本来已有该规则，不能把它说成此次新增加列数。最终列数应按两版同一可用内容宽度比较。 |
| 边框/半径/阴影 | 旧card border-border、rounded16、shadow-md；旧shadow-med实际仅2.7%/2%两层 | 新Card默认ring/rounded4xl/5%+10%阴影不能直接当业务配方。局部恢复border token、默认16px的radius-element×2、旧阴影几何与低透明度（新color-black/spacing token）。半径仍响应用户现有圆角选择，无全局token改动。list恢复element半径、无边框/阴影。 |
| 标题字体 | 旧span font-medium继承UI body，无强制serif；card16px/list14px | `next-note-heading h2`改用font-family-body；列表14px、20px行高。没有改用户全局heading/body设置。 |
| 头部/预览/标签分区 | 旧头部pt16/px16/pb8、预览px16/pb16、标签min40/px16/pb12 | 取消新版统一padding16+gap12，局部恢复旧分区。标签继续独立于打开按钮。 |
| 预览正文配方 | 旧styles.css:139–146：14px、20px、flow .4em、opacity .82；Markdown标题与正文同字号/字体，medium强调 | 仅 `.next-note-preview` 内 compact Markdown恢复对应配方；正文标题1em/继承正文、不再使用大号serif。完整阅读、编辑器、搜索预览不受这组局部规则影响。共享截断/标签去重hook不变。 |
| 标签与计数 | 旧TagPill基于Badge render button、20px/左右6px/font14 normal，gap8；最多2个及计数 | 新版从Button切为新Badge render原生button，保留data-tag/颜色和完整title。20px的局部selector强于Web/H5此前28px标签覆盖；计数仍有完整aria-label。 |
| 列表密度 | 旧无行gap、左右/上下8px；tags最多1/3、date112px并靠右 | 恢复0gap/8px、列表14px、tags1/3、date112；容器<768继续隐藏metadata，保留本轮已验收44px打开目标。 |
| hover/focus/键盘 | 旧hover overlay，卡片任意子控件focus均显示整卡轮廓；打开/过滤独立 | 背景改用新overlay-hover，focus selector包括标签；原生Badge button支持Enter/Space，不触发打开；打开Enter/Space保留。 |

## 验证与边界

- `collection-recipe-focused.log`：2文件/**8项通过**（既有集合6项+真实Markdown配方及Badge键盘2项），最新10:06:09。
- 新回归使用真实NoteMarkdown/NotePreview：界面标题绑定body role，正文h1与正文同字体/1em，compact flow .4em/14px/20px契约；clone移出集合后不再受局部heading规则影响；预览无button/a/input/tabindex。卡片与列表两种模式均用Enter/Space验证标签过滤与打开相互独立。
- 类型检查与focused ESLint通过；日志 `collection-recipe-typecheck.log`、`collection-recipe-lint.log`。
- 未构建、未操作浏览器、未修改真实笔记或fixture。CSS契约测试不代替像素截图；Root应在1440/390/320和同可用内容宽度下验证实际列数、256px卡高、16px默认半径/轻阴影、头部/正文/标签占高、截断、hover与焦点轮廓。
- 用户当前字体/圆角偏好继续生效；旧固定16px半径映射为新element角色的2倍，默认16px，用户选None仍归零。未回退全局Luma配方。

## 浏览器整卡命中回归修复

Root实测新版预览空白点击未打开，elementFromPoint命中相对定位且opacity .82的 `.note-preview-next`；该预览的stacking context盖住原打开按钮z0伪元素。旧版预览位于打开button内部，不存在该命中差异。

最小修复：`NoteCollection.css` 的 `.next-note-preview` 加 `pointer-events:none`。该区域原本遵守passive Markdown契约（无button/a/input/tabindex），因此事件透传到既有整卡打开区域；标签仍为独立Badge原生button，不增加外层onclick，不改打开逻辑或嵌套交互。

真实Markdown配方回归补充透传CSS契约，2文件/8项再次通过（10:13:28）。Root新增的date/list-date支持文本行高修正已保留；真实像素命中由Root原生指针复验，jsdom不冒充命中测试。
