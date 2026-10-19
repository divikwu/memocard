# 笔记集合与正文预览

## 维护边界

`NoteCollection` 与 `NotePreview` 是 Web 生产组件，桌面、H5 和 iOS 的 WKWebView 共用。Storybook 直接导入这些组件、现有 CSS 与 ThemeProvider，不复制卡片、Markdown 或编辑器。iOS 继续由原生标题菜单提供布局切换，系统导航、菜单和返回行为保持原有实现；不为共用 Web 内容另造 SwiftUI Preview。

集合的查询、标签范围、分页数据和打开笔记由调用方管理。故事中的示例调用方只在内存中过滤固定笔记并接收回调；打开后展示真实 NotePreview，返回后保留查询、标签和布局。该接收页用于核对回调与内容，不代替生产 Editor、路由或文件读写验收。

## 开发入口

- Storybook：`business/note collection`，核对浏览、列表/卡片切换、标签筛选、打开/返回、最近更新/已固定、加载、空态、不可用和分页。
- Storybook：`business/note preview`，核对空正文、Markdown 展开/收起、文本与表格摘要裁切、本地图片大图/焦点返回、图片缺失，以及 H5 表格横向滚动。
- 在 Canvas 运行 play 或手动交互；Docs 的隔离示例保留手动操作，默认不自动播放。桌面契约为 1024×900，标记 mobile 的故事为 390×844。
- 完整 App：iPhone 连接专用 QA 库，使用原生标题菜单切换列表/卡片，从卡片标签进入范围，打开笔记并用原生返回恢复集合。小屏列表按现有规则隐藏标签，不因此修改默认布局。

每故事使用临时偏好存储。图片只安装当前故事的精确路径和 binding 对应的 Blob；默认 bridge 拒绝真实库操作。内存状态、图片与故事代码不进入正式 App。

## 验收边界

执行 `pnpm verify:design` 检查类型、静态构建和真实 Chromium play；执行生产回归与 bundle 检查，核对生产源码和资源没有因故事新增而漂移。实际运行结果记录在 [validation.md](../validation.md)。

Storybook 的过滤/打开回调不能替代真实 App 的路由与数据验证；Chromium 不能替代 WKWebView。模拟器复核与自动测试分别记录。大列表滚动性能、所有 Markdown 组合、旧系统、真机与 iCloud 同步没有由这些故事自动覆盖。
