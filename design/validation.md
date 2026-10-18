# 侧栏试点验证记录

本文件随实际检查更新。尚未执行的检查不得标记通过。

实施基线：2026-10-18；工作区原有原生侧栏、Lucide、Preview 与性能用例等未提交变更已保留，快照位于本机 `/tmp/memocard-design-baseline-20261018-122024`。快照和本机截图属于辅助证据，不是可跨机器依赖。

| 检查 | 状态 | 说明 |
| --- | --- | --- |
| token 生成、别名与漂移检查 | 通过 | `tokens:check`、5 项 token 测试；错误类型、别名与只读漂移检查 |
| Storybook 类型、构建、浏览器故事 | 通过 | 19/19 Chromium 故事逐项断言实际尺寸：18 项桌面 1024×900、1 项 H5 390×844；另加 1 项真实断点回归，共 20/20；2 项跨 project 文件过滤不是跳过故事。初版尺寸记录更正见下文 |
| 原生 palette fixture | 通过 | 默认 mono/neutral 浅深色真实 CSS 采样；生成物检查一致 |
| Web/bridge 回归 | 通过 | 最终 60 文件 / 1047 项 UI 测试（单 worker，原超时）；同模式 palette 更新；126 native-core、8 network、14 local-Web、16 MCP 测试 |
| macOS / iOS 构建 | 通过 | 最终生产 Web 资源、Xcode 27.1 / SDK 27.1，Debug iOS Simulator 与 macOS 构建成功；最低部署目标 iOS 17，仅为编译覆盖 |
| Xcode Preview | 通过 | 浅色、深色 AX5、加载 fixture 实际渲染；图标/Text 源码选择与 Live 快捷筛选展开分别验证 |
| iPhone / iPad 模拟器 | 通过已列场景 | iPhone 18 Pro / iOS 27.0：快捷筛选、中文标签搜索、三级完整路径导航、品牌返回主页、设置往返、点击主页面关闭；iPad Pro 11 M5 / iPadOS 27.0：未连接笔记库空态、竖横屏和关闭。未在 iPad 复制真实笔记库 |
| Release 侧栏用例 | 通过 | iPhone 18 Pro / iOS 27.0，4/4，0 跳过；连接现有 QA 笔记库，有超过可见区域的多级标签；独立展开边缘命中、行导航、开合与滚动均执行 |

本机当前可用运行时为 iOS 27.0/27.1。最低部署版本构建兼容性与最低版本实际运行覆盖分别报告；真机、旧系统未实际运行时必须明确保留限制。token 试点不构成帧率、耗电或启动性能改善结论。

Release 用例结果位于本机 `build/verification/design-system/sidebar-tests.xcresult`。本次同时运行构建、浏览器和 Preview，启动测量波动较大；只作为场景执行与行为回归证据，不建立可比较的性能基线，不声称性能提升。

预览证据位于 `build/verification/design-system/`：图标与文字分别点击后定位到 `Image` / `Text` 的源码范围；深色 AX5 使用实际生成 palette，品牌文字保持单行截断；Live Preview 已实际展开快捷筛选。Canvas 的选择定位与源码修改工作流已验证，右侧仍由 Xcode 提供 Inspector，不能视为 Figma 式拖拽编辑器。

macOS 最终 Debug App 实际打开共用 Web 侧栏并验证收起/展开，截图为 `macos-sidebar-final.png`。iPhone 默认外观、中文搜索、iPad 竖横屏截图均位于同一验证目录。

实施阶段 CUA 拖动未完成 iPhone 边缘滑入验收；手势容器源码与实施前基线相同。交付阶段的 XCTest 手势验收见下文。未运行旧系统或真机；远程 CI 以交付 PR 的最新 head 结果为准。

token 无变化的重复构建保留四份生成物时间戳，新增 mtime 回归测试防止无意义触发 Xcode Preview 重编译。

## 最终自动检查

- `tokens:check` / `test:tokens`：5/5；`verify:design` 类型、静态构建、19/19 Chromium 故事、真实 CSS palette 漂移检查全部通过。
- `typecheck`、`lint`、`check:ui-primitives`、生产 UI/MCP 构建、全部 9 个 route 和初始资源/字体预算通过；未提高预算。最紧的移动首页 route 为 1,335,283 / 1,335,296 bytes raw，后续样式新增需关注余量。
- Xcode 工程及 schemes 再次生成后内容一致。
- 同时打开多个模拟器、Preview、并行构建期间的两轮 UI run 出现等待超时并中止，日志保留；关闭模拟器后单独运行 `pnpm --filter @memocard/ui exec vitest run --maxWorkers=1`，1047/1047 全部通过（102.89 秒），未修改 timeout、skip 或断言。其余 native/network/local-Web 与设计验证随后按顺序通过。
- 最终本机日志：`/tmp/memocard-design-quiet-ui-tests.log`、`/tmp/memocard-design-final-native-tests.log`、`/tmp/memocard-design-accepted-preview-verify.log`、`/tmp/memocard-design-ios-accepted-build.log`、`/tmp/memocard-design-mac-accepted-build.log`。这些日志未提交，跨机器请重跑对应命令。

## 交付审查与补验（2026-10-18）

- Web 侧栏／主题桥接与原生实现分别审查，未发现需要修改的生产回归；相关 4 文件 / 25 项 Web 测试通过。10 份 Lucide 矢量资源有效，工程与 3 个共享 scheme 在临时目录重新生成后逐字节一致。
- 修复 Storybook Autodocs 的主题污染：真实 ThemeProvider 会修改 document，故事改为独立 iframe，并为当前场景设置展示高度。真实 Chromium Docs 同时保持浅／深色；LivePalette 切换强调色与中性色不影响其他故事，真实 localStorage/cookie 标记不变，页面错误为 0。类型、静态构建、19/19 故事再次通过。证据为本机 `build/verification/design-system/autodocs-isolation.json` 与 `storybook-docs-isolation.png`。
- 新增 `testSidebarEdgeGesturesOpenAndCloseNavigation`，从闭合状态的左侧 12pt 拖入打开，再拖动右侧主卡片向左关闭；没有用导航按钮替代手势。最终 Release iPhone 18 Pro / iOS 27.0 用例通过（1/1，0 跳过），结果为本机 `build/verification/design-system/sidebar-edge-final.xcresult`，日志 `/tmp/memocard-sidebar-edge-final.log`。此项是实际模拟器 XCTest 行为验收，尚未由 CUA 再次操作复核；Mac 锁屏时不宣称界面工具已完成可见复核。
- 9 个 route／初始资源／字体预算及 Base UI 依赖检查再次通过，未提高预算；`pnpm audit --prod` 未发现已知漏洞。交付阶段没有修改生产侧栏布局或手势实现。

## 架构审查第 1–3 项修复（2026-10-18）

- 初版曾将 Vitest 配置的 1024×900 当作实际执行尺寸；审查确认 addon-vitest 10.6.2 会把未绑定故事视口的测试重设为 1200×900，该历史记录在此更正。现通过共享命名视口与故事 globals 明确 desktop / mobile；19 个故事逐项断言真实 innerWidth / innerHeight，新增 768→767→768→767 浏览器回归。全部 20/20 通过，验证桌面折叠状态保留、移动抽屉跨断点关闭，以及行高／字号 32/14 ↔ 48/16。
- 负向控制将 desktop 视口键临时设为未知值，18 项桌面故事均检测到真实 1200 != 1024；已恢复源码并重新通过 20 项。日志 `/tmp/memocard-review-viewport-negative-control.log`、`/tmp/memocard-review-storybook-tests.log`。
- 可见验收在 600px 窄 manager 确认桌面故事仍为桌面布局；足够的 Canvas 空间下直接读取到桌面 1024×900、H5 390×844。Storybook 10.6.2 manager 的可见高度会受窗口、附加面板和缩放影响，工具栏标注尺寸不能单独作为验收证据。已恢复浏览器临时尺寸覆盖。截图为本机 `build/verification/design-system/storybook-desktop-viewport-fixed.png` 与 `storybook-mobile-viewport-fixed.png`。
- 图标检查新增 `icons:check` 与 5 项回归，覆盖 SVG、Xcode metadata、缺失／漂移只读与 no-op mtime；10 组 / 20 份资源当前逐字节一致，资源内容未改变。已接入 `verify:design` 和现有设计 CI。
- 删除只写不读的 sidebar cookie 与 Storybook cookie accessor 覆盖；42 项 App/sidebar 业务回归通过。palette 采样改用生产 DEFAULT_APPEARANCE；2 项真实 Chromium 回归覆盖已提交 fixture 漂移、缺失／过期检查只读、无变化保留 mtime 与正常更新。Swift fixture 内容未改变。
- 类型检查、lint（既有 LiveMarkdownEditor Hook 警告保留）、生产 UI 构建、Base UI 检查与全部预算通过；最紧的移动首页为 1,335,202 / 1,335,296 bytes raw，余量 94 bytes。没有改动 iOS 源码、原生资源、生产布局或动作协议。本轮远程 CI 结果以 PR #48 最新 head 为准。

## 标签树索引与 iOS 状态订阅（2026-10-18）

- 从 `a53fb0a` 保存旧源码及 Release App，分别建立真实组件 SSR、实际 Swift getter、真实 `NativeHost.handle` publisher 和固定 QA 库 Simulator 基线；前后计时范围、源码指纹、样本与限制见 [performance.md](performance.md)。没有把算法计时或通知次数换算为帧率改善。
- Web 一次建 roots/children/byName 索引与置顶成员 Set；54 项相关回归通过。保留上游顺序、首个同名计数、孤儿/重复路径、平铺搜索、置顶操作和独立展开状态。复杂度回归先在旧实现检测到 80 标签读取 9,800 次，再在新实现通过线性上界，并检查仅选择变化不重读集合。
- Swift 在同次侧栏计算中复用当前 actions 与路径位置索引，不引入跨更新缓存；6/6 回归通过，包括 1,340 路径与旧谓词等价，以及重排、删除、清空和替换。10k 建表加遍历中位数 15,826.353 → 5.210ms 是算法对照，不含 SwiftUI 布局。
- 原生全字典 Host 发布改为每 surface 订阅与小型展示/外观投影。同值重放 100 次不再通知；100 次搜索内容更新只通知搜索本身。真实 bridge probe 通过 42 个独立字段变更及生命周期、实例、picker、主题/palette、展示投影断言，含 1k 标签同值大载荷；已加入 macOS `verify:release`。默认清理临时工程和自身 probe，自建 Simulator 才删除，不静默跳过缺失 runtime。
- 同一 iPhone 18 Pro / iOS 27.0、同一 QA 库，旧/新 Release XCTest 各 5/5 通过、无跳过，包含开合、边缘手势、展开/行操作分离和滚动前置条件。启动/滚动接近，旧开合基线波动较大；不声称真机、功耗或整体 App 提速。结果位于本机 `build/verification/sidebar-performance/{ui-baseline,ui-current}.xcresult`，便携测量记录已提交在 `design/performance/`。
- `verify:design`（20 项 Chromium 检查）、类型、lint 和生产构建通过；既有编辑器 Hook 警告保留。全部 bundle 预算未增加，最紧移动 route 仍为 1,335,202 / 1,335,296 bytes raw，CSS hash 不变。iOS 控件、布局、手势、资源和动作协议未替换；本次只调整数据索引和订阅来源。完整远程结果以 PR #48 最新 head 为准。
