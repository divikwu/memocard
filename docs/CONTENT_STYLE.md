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

## 检查与历史边界

`pnpm verify:design` 覆盖当前文档与组件，`pnpm verify:web` 覆盖产品类型、回归、构建、浏览器沙盒流程和资源门禁。内容风格的选择、恢复默认、存储失败与重载由当前 `WebTypography` / `WebSettings` 测试验证；真实 vault、中文 IME、系统选择器和跨设备同步另验。

2026-09-29 至 09-30 的 CodeMirror 源码装饰、早期字体默认和语义编辑迁移属于历史批次，不能作为当前实现说明。历史验收见 [内容页演进记录](CONTENT_PAGE_POLISH_ACCEPTANCE.md)；当前排版与平台职责以 [Typography](../design/typography.md)和[设计维护入口](../design/README.md)为准。
