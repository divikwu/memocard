# 编辑器与属性：源码对照及局部修复

2026-10-23。范围为旧 Editor / RichMarkdownEditor / NoteProperties 与 UI-next 的适配层；未改共享控制器、业务状态、文档内容模型、页面骨架、设置或搜索。浏览器成对验收由 root 统一执行，本记录不替代真实页面结论。

## 确定差异及修复

| 项目 | 旧版证据 | 新版回归与最小修复 | 验证边界 |
| --- | --- | --- | --- |
| 标题与属性纵向节奏 | `src/Editor.css:2-5` 是 block siblings，默认间距20px、属性8px、正文32px；标题仅inline inset8px | `ui-next/business/Editor.css` 原flex gap20/H5 16，标题另有block padding4、正文margin12。改回同样block sibling规则，用spacing token表达；标题仅inline padding8；保留新字号/字族/行高；恢复alert群32px/相邻8px和H5保存状态8px | root修改前实测桌面同seed：new标题top88/height48、属性top156（gap20）；old标题top88/height42、属性top138（gap8）。最终after数字取root浏览器报告；token字号导致的字高差异不回退 |
| H5链接类型选择portal样式丢失 | 旧`rich-format-tools.css`全局`.rich-type-options [role=option]` min-height44px | 新SelectContent portal挂body且只带rich-type-options，失去next-rich-ui祖先，H5 scoped规则不匹配。仅在RichFormatTools适配层给portaled SelectContent补next-rich-ui | 新测试先红closest=null；修复后真实组件DOM确认portal在dialog外但有next-rich-ui，Wiki选择、取消、回焦、选区不变且无onChange。实际44px几何需浏览器 |
| 扩展格式disabled视觉 | 旧`src/styles.css:57-62`统一禁用text/icon token；原生disabled移除链接不响应操作 | 新raw rich-format-item未接新Button，CSS无disabled颜色，hover仍给底色。局部补text-disabled/icon-disabled，hover排除:disabled | 原生disabled行为仍由shared core；颜色/hover最终由root实际pointer验证 |
| 宽表格滚动提示及键盘焦点 | `src/rich-table.ts:8-15`共享TableView提供region/tabindex/data-overflow；旧`import-layout.css`为tableWrapper提供“左右滚动查看完整表格”、fit-content提示及focus ring | 新note-content.css仅保留阅读typeset-scroll提示，rich-editor.css仅overflow-x。新增编辑器tableWrapper scoped提示（原文、width:fit-content）与焦点token，保留水平滚动和max-width100% | 共享溢出探测/键盘能力不改。提示伪元素、实际scrollWidth及Tab轮廓需root同8列表格Web/H5检查 |

## 复用面核对

- 新旧Editor均调用`createEditor`，标题、保存、失败重试、冲突副本/重载、待打开链接、保存状态、图片插入能力检查、prepareDelete/finish/撤销等仍共用`src/editor-core.tsx`。
- 新旧RichMarkdownEditor均调用`createRichMarkdownEditor`；标题折叠、块菜单/转型/移动/删除、slash插入、任务、数学、Wiki/普通链接、drag、表格动作共享core。新icon/Markdown/Code/Mermaid/Callout是视图适配，未换模型或重新注册编辑器。
- RichImageTools用相同`adjacentImage/imageMoveTransaction/splitImageRow/setImageWidths`及`applyImageTransaction`，对应菜单动作未丢失；新菜单有next-rich-ui portal scope。
- NoteProperties调用同一个`createNoteProperties`，Choice/Tag/Date/Image/Name亦复用同core；数值校验、Enter/ShiftEnter/blur/Escape、全库属性定义确认、重命名/选项/颜色、只读/保存中保护未另写一套。新Checkbox/Popover/Dropdown/Tooltip等来自新组件。
- 旧全局stylesheet没有重新加载；新UI的Noto/Luma/Typeset、语义颜色、圆角和控件配方保持本轮约定。

## 局部自动化

- `editor-properties-focused.log`: 6 files / **101 tests passed**，包括Editor11、RichAdapters以及NoteProperties/Choice/Tag/Image；新增1条H5链接portal回归，覆盖与真实组件状态相关的无写入取消与焦点，不增加CSS字符串镜像断言。
- `editor-link-portal-red.log`: 新用例在修复前确认为portal无next-rich-ui scope而失败。
- `editor-scoped-lint.log`: Editor.test.tsx / RichFormatTools.tsx ESLint 0 errors/warnings（空日志表示成功）。
- `editor-typecheck.log`: `pnpm --filter @memocard/ui typecheck:ui-next` exit0。
- 本agent未运行浏览器、共享构建或全量Lint；未写入真实笔记库；未提交或发布。最终总数需root去重，勿将101与全量重叠累计。

源码冻结：Editor.css / Editor.test.tsx / RichFormatTools.tsx / rich-editor.css。后续如root发现实际浏览器差异再定向跟进。
