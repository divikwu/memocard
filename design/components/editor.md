# 编辑器与原生笔记页外壳

## 当前实现

[Editor](../../apps/ui/ui/business/Editor.tsx) 与共享 [editor-core](../../apps/ui/src/editor-core.tsx) / [EditorSession](../../apps/ui/src/editor-session.ts) 管理标题、正文、草稿、版本校验和保存。富文本适配为 [RichMarkdownEditor](../../apps/ui/ui/business/RichMarkdownEditor.tsx)，使用共享 Tiptap / ProseMirror 内核。桌面、H5 与 iOS WKWebView 共用这些内容视图。

iOS 的返回、固定、页面菜单和原生确认由 [IOSAppChrome](../../apps/ui/ui/native/IOSAppChrome.tsx) 发布 surface，再由 [NativeChrome](../../apps/apple/Sources/NativeChrome.swift) 消费；编辑器不是 SwiftUI 重写。当前内容风格见[排版规范](../typography.md)和[内容风格](../../docs/CONTENT_STYLE.md)。

桌面 Web 详情页的 [浮动目录](../../apps/ui/ui/business/NoteOutline.tsx) 在正文至少有两个非空标题时显示，依据 H1–H6 实时生成。右侧短线提供层级与当前位置，悬停、键盘聚焦或点击可打开目录；章节跳转会展开目标的折叠祖先，并同步滚动位置及短暂定位高亮，高亮复用内容块选中的颜色、圆角与覆盖范围。文末主动跳转保留目标章节高亮，继续滚动后恢复跟踪；打开目录或当前章节变化时，列表将当前条目带入可视区，不改变正文滚动位置。目录使用现有滚动容器和 Base UI Popover，不修改 Markdown 或撤销历史；移动端、原生和不足两个标题的笔记不展示。浏览器回归覆盖实时标题、重复名称、折叠跳转、滚动跟踪、长目录和键盘退出。

## 隔离预览

[编辑器故事](../../apps/ui/ui/stories/business-editor.stories.tsx) 的目录为 `business/editor`，包含 Desktop、H5、只读、保存重试、内容样式和图片/并排布局。故事直接使用真实 Editor、当前控件及内存版本/附件 handler，未知操作拒绝，不读用户笔记库。

故事中的“完成并保存”通过 `EditorHandle.finish()` 调用实际保存；状态文字属于 fixture。完整打开 → 编辑 → 保存 → 返回 → 重新打开由 [Web & H5 页面故事](../../apps/ui/ui/stories/web-workspace.stories.tsx)和[WebApp 回归](../../apps/ui/ui/web/WebApp.test.tsx)覆盖，不把单组件回调冒充真实路由。

Xcode 在 `MemoCardiOS` / iPhone Simulator 下使用 NativeChrome 的 Main Chrome Preview，核对集合、详情、busy 和主题/大字配置。Preview 注入只读正文与内存 surface，不创建真实 WKWebView、vault 或本机服务；不能视作 SwiftUI 编辑器或真实文件保存验收。

## 验证

执行 `pnpm verify:design`、`pnpm verify:web`、`pnpm test:native-surfaces` 和相应 iOS 构建。共享内核验证 Markdown、撤销、附件和版本保护；原生默认 App 集成验证 surface 挂载及返回到搜索等操作回流。

保存失败时必须保留输入和草稿，重试成功后才离开页面；切库、busy、只读和陈旧请求分别检查。IME、软键盘、触摸选区、所有语法组合、系统 picker 和真实库/跨设备行为另验。历史结果见[验证记录](../validation.md)，本轮清理结果见[迁移记录](../ui-retirement-2026-10-25.md)。
