# MemoCard UI 重建验收（2026-09-29）

历史记录说明（2026-10-10 更新）：本文记录 2026-09-29 按上游模板重建 UI 时的实现及验收，当时采用 Radix 组件和 `asChild` 组合。2026-10-09 已统一迁移回 Base UI，使用 `render/useRender` 等原生 API；下文“移除 @base-ui/react”及与快照逐字一致的结论不代表当前代码。当前实现与验收见 [Base UI 系统迁移验收](../BASE_UI_MIGRATION.md)。本目录的上游原始源码快照、哈希和许可保持不变，仅用于视觉溯源。

## 范围与工作区保护

开始前审计了所有未提交及未跟踪内容；未执行 reset/clean、暂存、提交或发布。开始时的 UI 源码、package.json 与锁文件另存 `/tmp/memocard-ui-before`。对照该备份，本次只更改组件层、App 的展示 JSX、Editor 的 Dialog/API/标签输入展示、主题设置展示与默认值、样式和相应测试；浏览器文件访问、存储、Markdown、CodeMirror 编辑内核、图片/链接、标签重命名业务及原生 Swift 未被本次修改。

## 替换与删除

- 用官方快照替换 Button、Input、Select、DropdownMenu、Dialog、Sheet、Sidebar、Collapsible、Separator、Badge、Switch、Alert、Tabs、Textarea、Skeleton 实现；保留本来已等同官方的 Card。
- 增加官方 Popover、Tooltip、Breadcrumb。19 个基础组件中 18 个在规范化 import 路径后逐字等同固定快照，只有 Sidebar 有 README 所列行为和无障碍适配。全部快照哈希已校验。
- 替换 Base UI `render` 为官方 `asChild` 组合、迁移所有状态选择器；移除 `@base-ui/react` 及其专属适配。
- 删除 `tag-emoji-picker.css` 和第三方 Emoji UI，移除 `emoji-picker-react` 依赖；只保留中文 Emoji 数据及 MIT 许可，用统一组件重建搜索、分类和选择。
- 移除移动端基础控件 44px 强制尺寸；菜单/按钮采用同一套官方尺寸。移除自定义标签树子菜单缩进覆盖；Header 用官方 Breadcrumb/Separator 组合，设置页使用 Card。
- 恢复 new-york-v4 的减法圆角 token、默认 neutral/mono 色彩。用户已保存的外观偏好仍有效。

## 检查结果

- `pnpm lint`：通过（UI 与 MCP）。
- `pnpm typecheck`：通过（UI 与 MCP）。
- `pnpm test`：UI 20 个文件 / 194 项、MCP 16 项，全部通过。
- `pnpm build`：UI TypeScript + Vite 和 MCP 构建通过。
- 最后一次弹层高度/Emoji 网格调整后再次通过 UI lint、build 和完整 194 项 UI 测试。
- Vite 仍报告主 JS chunk 超过 500kB 的体积提示，不影响构建；本次未扩大为性能重构。

## 浏览器实际验收

通过 Codex 内嵌浏览器读取实际 DOM、计算样式、截图及 console；另打开官方在线 sidebar-10 比较尺寸。监听 PID 40919 的 CWD 为本仓库 `apps/ui`，监听 `127.0.0.1:5179`。

| 项目 | 结果 |
| --- | --- |
| 1440×900 桌面 | Sidebar 256px、Header 56px、Trigger 28×28px、导航行 32px、内容最大宽度 768px，与官方实测一致 |
| DropdownMenu | 页面操作和笔记库菜单可用；菜单行 32px，padding 6px 8px |
| 820×900 窄屏 | 设置页深色模式正常、无横向溢出；Select Trigger 36px、选项 32px |
| 390×844 移动 | Sheet 288px、行高 32px、遮罩 50%；导航切换关闭抽屉 |
| 移动转桌面再转移动 | 打开的 Sheet 自动关闭，不会重新弹出 |
| Popover / 标签 | 菜单退出后再打开编辑器，避免焦点抢占；保存图标更新导航；多级展开指示旋转 90° |
| Emoji | 中文跨分类搜索、分类 Select、选择和保存已实测；无第三方 UI/CSS |
| 320×700 窄移动 | Popover x=12、width=296、bottom=688；按可用高度滚动，scrollWidth=clientWidth=294，无横向溢出 |
| Editor / Dialog | 移动 390×844 全屏；桌面 720×680；正文输入、Markdown、标签添加、草稿提示与保存返回已实测 |
| 控制台 | 验收页未发现 error/warn |

开发入口 `/tests/ui-preview.html` 使用明确标注的内存模拟桥接，只用于 UI 验收。正常入口 `/` 也已打开并确认渲染。模拟笔记保存不构成原生磁盘写入或 iCloud 同步验收；本次没有重新运行 Mac/iPhone 原生端到端流程。现有文件读写、图片、链接、草稿、标签重命名的回归测试已通过。

官方模板没有编辑器、设置业务页或 Emoji 面板，因此这些是同一基础组件体系的产品组合，不是官方页面像素复刻。
