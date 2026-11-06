# 内容风格与 Typeset

设置 → 内容风格维护笔记阅读与编辑的四项排版偏好；字体统一跟随外观设置。当前设置由 [WebTypographySettings](../apps/ui/ui/web/WebTypographySettings.tsx)、[preferences](../apps/ui/src/features/typography/preferences.ts) 和 [TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx) 实现。

## 当前默认与存储

| 配置 | 默认值 | 可选范围 |
| --- | --- | --- |
| 字号基准 | 16px | 14 / 15 / 16 / 18px |
| 行高 | 1.6 | 1.6 / 1.75 / 1.9 |
| 段落间距 | 1em | 1 / 1.25 / 2em |
| 行宽档位 | 90（默认字号下 720px） | 60 / 70 / 80 / 90 |

行宽 ID 按字号基准乘以 28 / 33 / 37 / 45 计算，不是 CSS `ch`。恢复默认使用本表当前值；保留合法的行宽、字号、行高和段距值。旧内容字体字段不再使用，标题、正文与代码分别引用 UI 的 `--font-family-heading`、`--font-family-body` 和 `--font-family-code`。

配置以 `memocard.typography.v1` 保存在当前浏览器/宿主的 localStorage，不写 Markdown、笔记库或跨设备同步数据。同源标签页响应 storage 变化；非法值回退默认。保存失败提供提示；字体加载与重试由外观设置统一管理，当前会话仍可继续使用。随机搭配使用当前有效选项。

## 当前渲染与编辑

阅读样式为 [typeset.css](../apps/ui/ui/typeset.css) 和 [Typeset 主题](../apps/ui/ui/typeset-theme.css)，设置通过 [web-typography.css](../apps/ui/ui/web/web-typography.css) 映射到正文、笔记标题和代码。来源与许可见 [typeset.LICENSE](../apps/ui/src/typeset.LICENSE)。卡片摘要和搜索预览保留自己的紧凑密度；设置不改变导航或工具栏。

[NoteMarkdown](../apps/ui/ui/business/NoteMarkdown.tsx) 复用安全 Markdown 管线，支持 GFM、任务、标题、链接、Wiki 链接、脚注、授权本地图片、表格、公式及允许的 HTML 语义元素。表格提供可聚焦的横向滚动区域。原始 HTML 经过白名单清洗，不执行脚本、事件或任意样式；图片继续受库内附件边界限制。

编辑器使用 [RichMarkdownEditor](../apps/ui/ui/business/RichMarkdownEditor.tsx) 和共享 [rich-editor-core](../apps/ui/src/rich-editor-core.tsx) 的 Tiptap / ProseMirror 语义 DOM。表格、公式、图片、Callout、链接、脚注和格式菜单各保留版本、撤销及 Markdown 保护契约；未支持语法保留原格式，不承诺任意第三方 Markdown 扩展都可结构化编辑。

保存、草稿、附件与属性更新仍由共享业务内核处理。内容风格只改变显示，不改变 Markdown 源文件或保存位置；图片导入、未知格式和复杂表格的实际支持以当前编辑器回归为准。音视频导入/播放器未由 Typeset 样式选择器自动获得。

## 正文富块尺寸

下表以 16 px 根字号为基准。14 px 和 16 px 两档正文共用同一套留白，字号和行高仍按各自的排版角色计算。

| 部位 | 规格 |
| --- | --- |
| 编辑器块留白 | 顶层正文块外框四边各留 6 px，外边距为 0。编辑器用容器的行间隙统一控制块间距，默认 4 px。H1～H4 按层级调整外框顶部留白，默认排版中与上一块内容的距离依次为 40、36、32、24 px。H5 和 H6 的外框顶部使用共用的 6 px 内边距。段落和标题内层四边各留 2 px，富块内层左右各留 2 px，列表保留标记缩进。 |
| 圆角和选区 | 内容面板和块选区共用 4 px 圆角。单选、多选和全选都按同一个块外框绘制蓝底，蓝底间距随实际块间距。选中列表项时，蓝底横向覆盖列表标记。引用竖线宽 2 px，两端圆角 1 px。 |
| 提示块、代码和 Mermaid | 提示块和代码面板上下各留 12 px。Mermaid 源码和图形预览共用一个外框，内部间隔 8 px，两部分各自上下留 12 px。 |
| 表格 | 表头和正文格上下各留 12 px、左右各留 16 px。14 px 和 16 px 正文档的格内字号分别为 12 px 和 14 px，文字行高均为 20 px。单行含 1 px 分隔占位共 45 px，长内容随换行自然增高。三行样本含边框高 136 px。 |
| 图片与图注 | 未指定宽度的单图填满内容列并保持比例。显式宽度保留，最大宽度受内容列限制。图注与图片相隔 8 px，并排列之间相隔 16 px，窄屏按现有断点堆叠。左侧六点手柄移动整组，直接拖图移动单张，列间分隔线只在列间空隙内响应调宽。 |

样式来源为 [note-typography.css](../apps/ui/ui/business/note-typography.css) 和 [note-content.css](../apps/ui/ui/business/note-content.css)。编辑器蓝底路径由 [rich-block-frame.ts](../apps/ui/src/rich-block-frame.ts) 和 [rich-block-highlight.tsx](../apps/ui/src/rich-block-highlight.tsx) 计算。

## 检查与历史边界

`pnpm verify:design` 覆盖当前文档与组件，`pnpm verify:web` 覆盖产品类型、回归、构建、浏览器沙盒流程和资源门禁。内容风格的选择、恢复默认、存储失败与重载由当前 `WebTypography` / `WebSettings` 测试验证；真实 vault、中文 IME、系统选择器和跨设备同步另验。

2026-09-29 至 09-30 的 CodeMirror 源码装饰、早期字体默认和语义编辑迁移属于历史批次，不能作为当前实现说明。历史验收见 [内容页演进记录](CONTENT_PAGE_POLISH_ACCEPTANCE.md)；当前排版与平台职责以 [Typography](../design/typography.md)和[设计维护入口](../design/README.md)为准。
