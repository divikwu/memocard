# 搜索与快速记录

## 当前维护来源

Web / H5 使用 [NoteSearchDialog](../../apps/ui/ui-next/business/NoteSearchDialog.tsx) 与 [QuickCapture](../../apps/ui/ui-next/business/QuickCapture.tsx)，共享搜索 hook、捕获草稿和保存内核。iOS producer 沿用相同内核并发布 native surface，界面由 [NativeChrome](../../apps/apple/Sources/NativeChrome.swift) / [NativeDesignedPanel](../../apps/apple/Sources/NativeDesignedPanel.swift) 渲染，不同时弹出一份网页搜索或捕获面板。

| 入口 | 当前数据与职责 |
| --- | --- |
| [搜索故事](../../apps/ui/ui-next/stories/business-note-search.stories.tsx) | `business/note search`；真实去抖查询、选择、分页、预览、重试和会话恢复 |
| [捕获故事](../../apps/ui/ui-next/stories/business-quick-capture.stories.tsx) | `business/quick capture`；文本、正文标签、附件、临时草稿、保存及继续页面 |
| [页面故事](../../apps/ui/ui-next/stories/web-workspace.stories.tsx) | 真实 App 控制器中的搜索 → 详情 → 返回和捕获 → 刷新集合 |
| [原生适配](../../apps/ui/ui-next/native/IOSAppChrome.tsx)与原生 Preview | 系统输入/键盘/选择器、surface instance/ACK、关闭和原生动作 |

[test-support/bridge.ts](../../apps/ui/test-support/bridge.ts) 默认拒绝未配置的数据和资产操作，每故事重置临时 handler、存储和图片。原生 Preview 使用隔离 Host，无 WebView、vault 或服务，示例图片在内存中生成。开发场景的失败开关不是产品能力，也不应通过破坏真实目录权限来制造保存失败。

## 操作闭环

- 搜索：打开 → 输入/清空 → 加载 → 结果/空态/错误 → 重试或分页 → 打开笔记 → 返回。桌面方向键/Enter/Escape 与焦点恢复、H5/原生保留关键词与结果会话分别验证。
- 快速记录：输入 → 正文标签/附件 → 本机临时草稿 → 记录 → busy → 成功重置或失败保留。H5 抽屉收起保留内容，可继续为页面；原生使用浮动输入和系统控件。
- 搜索不受当前标签范围限制，列表内查询仍筛选当前视图。捕获只有标签时不创建空笔记；图片选择与正式笔记提交是不同动作。

Xcode 使用 NativeChrome 的 Search / Capture Preview 核对近期/结果、浅深色和大字，以及文字 ACK、关闭重开、重置和失败后再提交。预览控制不属于产品布局。

## 验证

`pnpm verify:design` 检查当前故事与浏览器质量场景；`pnpm verify:web` 检查生产逻辑、资源和默认沙盒流程；`pnpm test:native-surfaces` 在 Simulator 编译真实原生消费者，核对订阅、输入 ACK、预览保护和隔离。默认 App 的原生集成另验证搜索、捕获挂载和业务动作回流。

内存保存、浏览器沙盒文件、原生 surface probe 和真实用户 QA 库分别报告。IME、软键盘、目录/图片权限、系统 picker、真机手势、功耗和 iCloud 同步另验。历史结果见[验证记录](../validation.md)，现行平台职责见[组件归属](../component-ownership.md)。
