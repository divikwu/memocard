# 侧栏试点验证记录

本文件随实际检查更新。尚未执行的检查不得标记通过。

## 笔记集合与正文预览（2026-10-19）

- 新增 NoteCollection 9 个、NotePreview 7 个独立故事，直接使用生产组件、Markdown、CSS 和 ThemeProvider。集合的内存调用方覆盖浏览、键盘布局切换、标签/查询、打开/返回后状态保留、最近/固定、分页、加载/空态/禁用；接收页仅展示真实 NotePreview，不代替 Editor 或真实路由。移动端保留隐藏 Web 工具栏的既有行为，分别验证默认卡片与已保存列表，布局切换仍由 App 外层菜单提供。
- 正文覆盖默认空态、全文展开/收起、文本与完整表格行裁切、标签行去重、隔离 Blob 图片成功/缺失、大图关闭/焦点恢复，以及 H5 表格方向键横向滚动。没有添加外网资产或真实库 fallback。首轮集合测试误点移动端隐藏工具栏与 `pointer-events: none` 的禁用按钮，已按真实能力契约修正；没有改生产 CSS 或绕过禁用状态强制点击。
- 最终 `pnpm verify:design` 通过：83 个故事（74 桌面 1024×900、9 H5 390×844）加 1 项真实断点回归，共 84/84；类型/静态构建、维护表/token 映射、token/icon 与真实 palette 检查通过。原生 Preview 没有新增：这两个组件是共用 Web 内容，应复核 iOS 实际 WKWebView。
- `pnpm verify` 通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，类型/lint/生产构建与全部 bundle 预算通过；保留既有编辑器 Hook 警告和大 chunk 提示。移动首页仍为 1,335,281 / 1,335,296 bytes raw，未提高预算。231 份 Web 源文件、164 份生产产物和 54 份原生源码/资源共 449 份文件逐一 SHA256 与本轮基线一致。
- Storybook 实际 Canvas 手动完成列表切换、产品标签筛选、打开项目计划及返回，列表与标签保留；截图位于本机 `build/verification/note-browser/storybook-collection-*.jpg`。Canvas 仅调整显示缩放为 75%，实际故事视口契约保持。缩放弹层打开时触发的 play 因 iframe body 被 Storybook 设为 inert 而失焦；关闭设置并重置故事后完整 play 成功，不将该次 UI 干扰记录为组件回归。
- iOS 新 Debug 和 Release Simulator 构建成功，保留现有数据容器安装到 iPhone 18 Pro / iOS 27.0。真实 Release App 连接 MemoCard iOS QA 库，实际完成主页列表→原生菜单切换卡片→卡片标签“体验/使用指南”→真实 Editor→原生返回，过滤条件保留；同一筛选再切换列表、打开和返回。最后恢复主页列表与笔记集合卡片。原生搜索另打开“体验 · 卡片内容的节奏”，可见图片与正文；未编辑或保存笔记。实际 App 截图为本机 `build/verification/note-browser/simulator-{home-cards,tag-filtered,opened-note,tag-list,home-restored}.jpg`。
- 首轮手机画面点按失效且顶部/正文未暴露可选节点，用户也确认无法打开菜单；系统 Settings 同样无法响应坐标点按。退出 Device Hub 时选择保留模拟器运行，再重新打开窗口后，系统 Settings 与实际 App 点按恢复，随后完成上述可见验收。未确定底层输入机制的根因，不据此修改 App。临时真实 NativeChrome 根容器 probe 的 4 项命中路由检查通过，仅作为容器路由诊断，不能替代真实触控验收；诊断源码已撤销，快照保留在 ignored 验收目录。
- 验收后 58/58 库文件与 bookmark 保持原样，449/449 生产文件仍与基线一致，已安装 Release 与当前 Release 构建的 170/170 文件匹配。App 数据容器路径与基线不同，不将保留安装表述为路径完全相同。主页由缺省列表变为显式保存 `list`，笔记集合恢复 `cards`，其他已检查存储项未改；这里只确认布局语义恢复，不声称存储字节完全相同。前后快照为本机 `build/verification/note-browser/iphone-{before,after}.json`。
- 首轮 [PR #49 Verify #39236038894](https://github.com/divikwu/memocard/actions/runs/39236038894) 的 design 通过；release 的原生探针在模拟器启动、安装成功后，`simctl launch --console` 超出原 60 秒上限且没有 App 阶段标记，未执行到业务断言。保留失败记录，不将其计为通过；没有延长超时或修改原生探针，最终远程结果以 PR 最新 head 为准。
- 本机日志为 `/tmp/memocard-note-browser-{design-delivery,verify,ios-build,ios-release-build}.log`；定向测试与截图属于辅助证据，未作为可跨机器依赖提交。旧系统、真机、iCloud 同步、大列表性能及所有 Markdown 组合未在本轮覆盖。

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
- 补验生产 `NativeDesignedPanel` 与真实 `UITextField` 的 3 个输入场景：未变化的 Return/失焦事件不再创建覆盖值；真实 pending B 在无关更新和旧回包下保留，确认 B 后能接受 C。冻结未修正优化版在数据已到 UIKit 后仍显示 A，同一 harness 修正后通过；事件发送保留，未引入新输入协议。最终指纹与复跑结果附于 `sidebar-subscriptions.json` 的 `finalValidation`。
- 同一 iPhone 18 Pro / iOS 27.0、同一 QA 库，旧/新 Release XCTest 各 5/5 通过、无跳过，包含开合、边缘手势、展开/行操作分离和滚动前置条件。启动/滚动接近，旧开合基线波动较大；不声称真机、功耗或整体 App 提速。结果位于本机 `build/verification/sidebar-performance/{ui-baseline,ui-current}.xcresult`，便携测量记录已提交在 `design/performance/`。
- `verify:design`（20 项 Chromium 检查）、类型、lint 和生产构建通过；既有编辑器 Hook 警告保留。全部 bundle 预算未增加，最紧移动 route 仍为 1,335,202 / 1,335,296 bytes raw，CSS hash 不变。iOS 控件、布局、手势、资源和动作协议未替换；本次只调整数据索引和订阅来源。完整远程结果以 PR #48 最新 head 为准。


## 组件维护与 Foundations 扩展（2026-10-19）

- 新增 [已使用组件维护表](component-inventory.md)：76 个从 Web 生产入口可达的 TSX 模块，加 7 个原生维护家族，共 83 条。自动门禁校验 Web 模块遗漏、失效/重复记录、必填说明和链接；Swift 家族仍需人工登记。模块可达不代表每个导出组件都已渲染，也不代表所有状态都有独立故事。
- 新增 [token 消费映射](token-consumption.md)：逐一登记全部 27 个可移植 token 的 Web / Swift 消费或不适用原因，并标注别名和仅作基准展示的值；另列动态颜色、字体/排版、图标、阴影/焦点及系统职责。9 个保留的 CSS 颜色角色明确标为尚无生产消费者。校验检查声明与源路径，不冒充运行时消费分析。两组门禁的 10 项正反例测试通过，已接入现有 design / release 验证。
- Foundations 新增颜色、排版、效果三组：真实 CSS 语义色与标签色、实际 TypographyProvider / Typeset 样本、同源 Lucide SVG、现有阴影和键盘焦点；原 tokens 页面补充 spacing 基准。高频基础组件补齐 Button、Input、Textarea、Select、Switch、Tabs、Dialog、Dropdown Menu、Popover、Tooltip、Sheet 共 11 类 / 30 个新故事，使用生产包装，覆盖适用的编辑/禁用/只读/无效、键盘激活、关闭与焦点恢复。未新增底部 Sheet 滑动验收或替换原生控件。
- Storybook 总计 53 个故事（51 桌面、2 H5）及 1 项真实断点回归，共 54 项 Chromium 检查全部通过。新增 Select / Switch / Tabs 的依赖预优化，避免转译后的虚拟故事晚发现依赖而刷新测试页。第一次完整冷启动中既有侧栏三级标签查找曾超时；错误 DOM 截断，未证明具体原因。现有 fixture 在 beforeEach 等待真实标签模块就绪，保留原始超时/断言并增加失败诊断；随后无生成缓存的完整冷启动 54/54 通过，没有用重试或延长等待掩盖失败。
- 可见复核发现新效果故事的 SVG data URL 未加引号，CSS mask 被浏览器丢弃而显示黑块；已修复引用，并增加每个 mask 的 computed style、资源解码及 intrinsic size 断言。实际页面确认 10 个 Lucide 图形正确显示。该问题仅存在于本轮新故事，生产资源未改。最终设计验证另行完整重跑，通过 54/54、类型、静态构建、token/icon 与 palette 检查。
- 可见 Autodocs 原先会并发运行隔离 iframe 的 play，导致焦点争抢。10.6.2 的 iframe 分支忽略 docs.story.autoplay，现使用公开 Story block 覆盖与 Core embed 模式静态展示，Docs 改为只读 ArgTypes；实际手动 Sheet 打开、Escape、焦点返回正常，480px / 844px 高度保留。静态 Docs 的 Primary 隐藏不再适用的缩放工具栏；Canvas Controls、缩放与测试 play 保持；可见操作将右侧 Sheet 的 side 改为 bottom 后确认实际底部布局，再恢复默认值。新 Select 故事曾在首个方向键后仍聚焦初始选项，未取得完整内部时序；现先等待初始选项真正获焦再操作，保留原等待预算与全部断言。
- 本机 `pnpm verify` 通过：1053 项 UI、126 项 native-core 及 network/local-Web/MCP 回归，类型、lint、生产构建、Base UI 与全部资源预算通过。既有编辑器 Hook 警告和大 chunk 提示保留。最紧移动 route 仍为 1,335,202 / 1,335,296 bytes raw，未提高预算。
- 本轮前后 `apps/ui/src` 全部 231 份文件和生产 `apps/ui/dist` 全部 164 份文件逐一 SHA256 相同；Swift、token 值、原生资源与动作协议没有改动。此证据说明本轮没有引入生产产物变化；没有把上一轮 Xcode Preview / iPhone / iPad 验收计作本轮重新运行。
- 本机可见复核确认颜色目录加载、排版按钮使真实正文从 16px 变为 18px 后恢复、Dialog 打开 / Escape / 焦点返回，以及 H5 Sheet 的 390px 宽度；可见窗口会裁剪 Canvas 高度，不以工具栏数字替代真实视口断言。修复后的图标、阴影和焦点截图为 `build/verification/design-maintenance/storybook-foundations-effects.png`。本机辅助日志位于 `/tmp/memocard-design-maintenance-*`；它们未提交，跨机器应重跑命令。
- 未覆盖所有业务组件的独立故事；缺口逐项保留在维护表。iOS 搜索/快速记录独立 Preview、旧 OS / 真机、完整视觉快照及全组件无障碍审计没有在本轮完成。远程 CI 以 PR #48 最新 head 为准。

## 搜索与快速记录交互预览（2026-10-19）

- 新增 6 个搜索、8 个快速记录故事，直接使用生产组件、CSS 与 Markdown。覆盖输入/清空、旧响应拒绝、键盘选择、关闭/焦点恢复、错误重试、分页、标签、内存附件及图片预览、busy 禁用、保存失败保留/成功重置；H5 另含抽屉、草稿恢复和继续页面回调。后者用示例调用方文本框接收草稿，不冒充完整编辑器。
- Storybook bridge 默认拒绝数据操作和资产读取；每故事只安装明确的内存响应与精确路径/binding 的 Blob，结束后清理。4 项门禁测试覆盖默认拒绝、参数转发、旧 cleanup 不影响新 fixture、资产绑定与 reset。实际 Markdown 依赖显式预优化后，无 `.vite` 缓存的设计验证通过；初次依赖重优化导致浏览器中途重载的失败日志保留，不以重试代替修复。
- 本轮 `pnpm verify:design` 已有完整通过：67 个故事（61 桌面、6 H5）加真实断点回归，共 68/68 Chromium 检查，类型/静态构建、token/icon、组件维护/token 映射和真实 palette 检查通过。Docs 的隔离 iframe 按同一 mobile tag 固定宽度；可见实测快速记录 3 个 H5 iframe 均为 390×844，Docs 不自动运行 play，手动保存失败/保留/重试成功及“切换为页面”传递草稿已复核。
- 搜索 Loading 故事先挂起旧空查询，再完成新查询和旧响应。冻结删除生产初次查询 epoch guard 后，同一故事以结果数 4 != 3 失败；恢复原始源码后通过。生产搜索文件恢复前后 SHA256 相同；没有弱化断言、延长超时或保留生产改动。
- 最终 `pnpm verify` 通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，类型/lint/生产构建与全部资源预算通过。预览初版完整 UI run 的 5 个既有用例曾出现超时/缺失元素，日志保留；相同源码、原 worker 和超时下，4 个相关文件 200/200 及完整 1057/1057 随后通过。未确定首次失败原因，不宣称已消除环境波动。既有编辑器 Hook 和大 chunk 提示保留。
- 预览初版 `e97a454` 的 Web 源码 231 份、构建产物 164 份前后 SHA256 相同；后续 CI 揭示下面的生产聚焦竞态，最终仅改 `quick-capture.tsx` 与对应测试，CSS/图标/token 和原生布局未变。最终最紧移动 route 为 1,335,281 / 1,335,296 bytes raw，增加 79 bytes、未提高预算。Swift 仅增加 DEBUG 预览接缝和复用生产 overlay 的场景控制，不替换原生组件或动作协议；反馈通过真实 Host 的 instance/presented/action/disabled 校验，图片不回落读取真实笔记库。
- iOS Simulator Release（Xcode / SDK 27.1，arm64 + x86_64）构建成功；产物符号中无 `NativeSurfacePreviewModel` / `NativeSurfacePreviewCanvas`。Xcode 工程重新生成逐字节一致。此项未安装替换现有完整 App，也不把最低部署版本编译覆盖当作旧系统运行验收。
- `pnpm test:native-surfaces` 的真实 Simulator probe 通过原 42 个字段变更、6 个订阅场景、3 个 UIKit 输入场景，并新增 15 个预览边界/取消检查、2 个挂载生产 overlay 的交互闭环。实际 `UITextView.insertText` 逐字输入 `preview`，7 步文本、model ACK 和末尾 caret 均一致。首次图片尺寸与未变化 Return 反馈的失败已在内存 fixture 中修正并复测；输入准备阶段的独立失败记录保留，最终逐字用例直接从已就绪空编辑器开始，没有改动生产输入 setter、ACK 调度或等待预算。
- Xcode 27.1 的 Canvas 实际渲染 Search 默认/深色大字与 Capture 默认/深色大字四个独立入口；本轮 Canvas 自动化未成功完成直接键入，只将其计为渲染验收。iPhone 18 Pro / iOS 27.0 的独立临时内存 App 复用相同生产 overlay/PreviewModel，已可见验证搜索输入/空态/清空/选择关闭/分页/错误重试，以及记录展开、标签搜索/新建、图片预览/关闭、保存失败保留和再次记录成功后重开空白。未写真实库或触发真实系统照片选择器。
- 模拟器界面工具逐键输入曾观察到一次 `previewp`；上面的真实 UIKit 逐字回归未复现，原因未归因。中文查询可见输入与直接 delegate ACK 不等于中文 IME 组合输入已通过。旧 OS、真机、iPad、真实 bridge 保存、权限/picker 和完整布局矩阵仍需针对性 App 验证，不将预览或 ASCII 回归升级为这些覆盖。
- 首轮远程 [Verify #39208585487](https://github.com/divikwu/memocard/actions/runs/39208585487) 的 design 为 66/68：快速记录成功后焦点未恢复，H5 搜索 Enter 回调为 0。本机观测真实 rAF 执行时 textarea 仍 disabled / busy，随后 DOM 才解除禁用；原聚焦无效。新增确定性回归按此顺序先失败，再以一次性 ref + DOM 提交后的 effect 修复，原 Story 的焦点断言与超时保持，24 项组件测试及 8 个记录故事通过。H5 搜索补齐真实查询、输入焦点、选中项/ARIA 提交后再发送 Enter，并增加失败诊断；原始失败现场不足，不能宣称已确认 H5 失败根因。
- 焦点修复后在真实 Storybook Canvas 手动输入并记录，空白输入框恢复 enabled 与焦点，页面显示对应成功回调；截图为 `storybook-capture-focus-fixed.png`。完整设计复跑曾出现既有断点用例 15 秒超时，67 个组件故事通过；原样单独运行断点用例 1/1 通过（1.45 秒）。未修改侧栏、该用例、worker 或超时，原失败日志保留，不以一次单跑通过归因；随后完整 `pnpm verify:design` 复跑 68/68 及 palette 全部通过，日志 `/tmp/memocard-search-capture-focus-design-repeat.log`。
- 同一 run 的 release 通过原 42/6/3、15 guards、搜索闭环和 7 个逐字断言后缺少完成标记：boot 62.040s / install 15.472s / launch 44.947s 均在原上限内，不能记为超时或已通过。仅补 capture 后半段日志、缺 marker 时卸载前的有界生命周期/crash 诊断；正常路径、业务断言与全部 deadline 不变。AttributeGraph cycle 曾出现但后续断言继续通过，没有据此归因。
- 诊断版 harness 在本机 iOS 27.0 全部通过，capture 后半段、cleanup 和最终 marker 齐全，11 份原生源码指纹不变；此结果不能替代 CI iOS 26.5 的缺 marker 原因调查。最终本机结果位于 `/tmp/memocard-native-preview-ci-diagnostics-20261019/`。
- 第二轮 `436f117` 的远程 design 中快速记录通过，H5 搜索前置断言捕捉到分页后的 Dialog 抢焦。真实调用栈表明 Base UI 在分页按钮移除后先微任务、再下一帧恢复 Popup 焦点；受控执行其已排队的原始回调于输入点击之后，准确复现 INPUT → DIV 与原焦点断言失败。故事只新增等待实际 Popup 恢复及该浏览器帧提交，再执行原点击，保留全部焦点/选择/回调断言，不改生产组件、调度或超时；6 项搜索定向验证通过。红绿日志为 `/tmp/memocard-note-search-focus-{controlled-red,targeted-green}.log`，CI 原始现场不足以独立证明同一调用栈。最终帧同步版本的完整本机运行中 67 个组件故事通过，既有断点用例再次 15 秒超时；保留原断言/超时与此前单跑通过证据，不将该次完整命令标为通过。
- 本机截图位于 `build/verification/search-capture/`；生产最终日志为 `/tmp/memocard-search-capture-focus-verify-final.log`，初版设计/原生结果和红绿证据亦保留在 `/tmp/memocard-search-capture-*`、`/tmp/memocard-quick-capture-*` 与 `/tmp/memocard-native-preview-*`。这些辅助文件未提交，跨机器应重跑已维护的故事和 harness。
- 第二轮 [Verify #39209982954](https://github.com/divikwu/memocard/actions/runs/39209982954) 的 release 在 `simctl bootstatus` 原 180 秒上限失败，probe 尚未安装、App 业务断言未运行；UI 1058、native-core 126、Swift 索引 6 等此前阶段通过。与首轮 App 缺 marker 是不同阶段，不合并归因为同一问题，也不延长上限。
