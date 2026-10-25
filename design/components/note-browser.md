# 笔记集合与正文预览

## 当前实现与职责

[NoteCollection](../../apps/ui/ui-next/business/NoteCollection.tsx)、[NotePreview](../../apps/ui/ui-next/business/NotePreview.tsx) 和 [NoteMarkdown](../../apps/ui/ui-next/business/NoteMarkdown.tsx) 是唯一生产视图，桌面、H5 和 iOS WKWebView 共用。主题来自 Luma CSS，外观由 WebAppearance / PreviewModeProvider 应用，正文偏好独立。

集合的查询范围、标签、分页和打开笔记由共享 App 控制器管理。主页默认列表、其他集合默认卡片，已有布局偏好继续读取；主页独立存储布局。iOS 原生标题菜单与内容集合使用同一布局 hook，不能出现菜单选中与页面布局不一致。

## 预览入口

- [集合故事](../../apps/ui/ui-next/stories/business-note-collection.stories.tsx)：`business/note collection`，核对列表/卡片、标签、查询、分页、打开/返回、主页 tabs、加载与空态。
- [摘要故事](../../apps/ui/ui-next/stories/business-note-preview.stories.tsx)：`business/note preview`，核对正文展开、摘要裁切、表格、本地图片及失败状态。
- [页面故事](../../apps/ui/ui-next/stories/web-workspace.stories.tsx)：`pages/Web & H5`，通过真实 App 控制器验证跨组件操作。

故事 fixture 只在内存中过滤、打开和保存，临时偏好与精确图片路径/binding 通过[隔离桥](../../apps/ui/test-support/bridge.ts)提供。单组件的接收页只核对回调，不能替代生产 Editor、真实路由或文件读写。

## 交互与验证

布局使用可访问的按钮组和 `aria-pressed`，通过 Tab / Enter / Space 操作；主页“最近更新/已固定”仍为内容 Tabs。标签按钮只改变范围，独立打开按钮按稳定笔记 ID 导航；加载更多、忙碌、错误和保留旧结果各有状态。窄屏布局通过顶部菜单操作，正文不重复展示完整工具栏。

执行 `pnpm verify:design` 与 `pnpm verify:web`；iOS 使用原生菜单和返回操作核对布局同步、集合与搜索会话恢复。Storybook 的 1024×900 / 390×844 浏览器回归、生产沙盒流程与 Simulator 是独立证据。

大库 DOM/布局、真实滚动帧率、全部 Markdown 组合、真实附件、旧系统、辅助技术和跨设备同步不由单组件故事自动覆盖。历史验收见[验证记录](../validation.md)，当前功能清理边界见[迁移记录](../ui-retirement-2026-10-25.md)。
