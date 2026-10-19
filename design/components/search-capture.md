# 搜索与快速记录

## 维护来源

Web / H5 使用生产 `NoteSearchDialog` 与 `QuickCapture`；iOS 继续使用 `NativeChrome.swift` 中的 `NativeEdgeSearchOverlay` / `NativeFloatingCaptureOverlay`，内部仍是生产 `NativeDesignedPanel`、`UISearchTextField`、`TextEditor`、Popover、Menu 和系统图片预览。预览不复制生产布局，不新增运行时 token、组件 DSL 或业务数据层。

| 入口 | 数据与反馈 | 保留的边界 |
| --- | --- | --- |
| `apps/ui/stories/note-search.stories.tsx` | 每故事 `queryNotes` 内存响应；真实 query、选择、分页、重试和打开回调 | debounce、旧响应拒绝、Markdown 预览、键盘、关闭与会话恢复仍由生产组件实现 |
| `apps/ui/stories/quick-capture.stories.tsx` | 内存保存/附件响应、临时 storage、真实回调 | 文本、标签、附件、草稿保护、busy、记录和继续编辑仍由生产组件实现 |
| `apps/apple/Sources/NativeChrome.swift` 的 Search / Capture Preview | `NativeSurfacePreviewModel` 发送隔离 surface，接收通过真实 Host 校验的动作并 ACK | 生产 overlay、输入覆盖值、instance、resetKey、关闭手势、原生布局与系统控件保持 |

`apps/ui/.storybook/bridge.ts` 默认拒绝全部数据操作与资产读取，故事显式安装最小处理器；全局 beforeEach / cleanup 重置处理器、内存资产和 storage。附件只有当前 fixture 的精确路径与 binding 可读，未知操作/路径不会回落到真实 API、vault 或文件。Docs 仍以隔离 iframe 静态展示初始场景，手动操作可用，完整 play 在 Canvas / Vitest 执行。

原生反馈和图片 fixture 仅在 `DEBUG && os(iOS)` 编译。`NativeHost` 的 preview 回调位于原有 instance、presented、action/field 与 disabled 校验之后；普通 App 未配置回调时继续使用原有 Web action 分发。Preview 使用失败的 core、无 WebView / vault / 本地服务；示例图片在内存中生成。它只验证原生消费与反馈，不冒充 React producer 或真实保存逻辑。

## 操作闭环

- 搜索：打开 → 输入 / 清空 → 加载 → 结果 / 空态 / 错误 → 重试或分页 → 选择笔记 → 关闭 / 重新打开。桌面包含方向键、Enter、Escape、返回焦点与所选笔记预览；H5 包含保留会话。
- 快速记录：输入 → 选择 / 新建 / 移除标签、添加 / 预览 / 移除示例图片 → 保存中禁用 → 失败保留 → 再次记录成功 → 内容重置与成功回调。H5 另含底部抽屉、关闭重开、内存草稿恢复与继续页面。
- Xcode：选择 `MemoCardiOS` 与 iPhone Simulator，打开 `NativeChrome.swift` 并启用 Canvas。四个独立入口为 `Search · Recent`、`Search · Results · Dark Large`、`Capture · Default`、`Capture · Populated · Dark Large`。Live 模式可输入；上方场景选择、重新打开、重置及“下次保存失败”是预览控制，不属于产品布局。

搜索场景包括 Recent / Results / Loading / Empty / ErrorRetry / Pagination；记录包括 Default / Populated / Busy / ErrorRetry / DraftRestored / Attachments。场景名只用于开发，不要求 Web 与 iOS 共享状态引擎或完全相同的控件树。原生保存失败保留原有“记录”按钮用于再次提交，不新增产品重试动作。

Web 非抽屉记录成功后，通过一次性标志在新 capture / busy 状态完成 DOM 提交后恢复输入焦点。浏览器帧可能早于 React 解除 disabled；组件回归固定覆盖这个顺序，原 Story 的保存后焦点断言保持。

## 验收

`pnpm verify:design` 检查故事真实视口、类型、构建、交互以及 token / icon / palette 漂移；`pnpm verify` 检查生产回归与资源预算。`pnpm test:native-surfaces` 使用真实 Host / 生产控件，检查订阅、输入 ACK 与预览反馈边界。命令通过和可见验收分别记录在 [validation.md](../validation.md)。

Storybook、Xcode Canvas、Simulator 是三个独立验收面。隔离保存不写入真实笔记库；真实库、iCloud、系统 picker / 照片权限、输入法、旧 OS、真机、功耗及完整尺寸矩阵仍需针对性 App 验证，不由预览故事自动覆盖。
