# 侧栏试点验证记录

本文件随实际检查更新。尚未执行的检查不得标记通过。

## Button 参数行、代码面板与切页状态（2026-10-20）

- Properties 改为一组八行参数：名称、类型/默认值、说明和当前控件在同一行；六项可编辑，`onClick` / `render` 只读。CSF 与参数行共用 Button 专属 metadata，移除重复 ArgTypes 表。所有 Button Docs 示例与参数预览共用代码面板，默认收起，使用 Storybook Source 的 TSX 高亮和内建 Copy，不增加第二个复制入口。
- 真实 Docs 已验证复杂文字、variant / size / type、禁用、Reset、图标名称、点击计数和动态代码同步；文字及图标代码分别通过实际 Copy 写入剪贴板并读回，与展示代码逐字相同。代码存在 71 个高亮 span，复制入口只有一个。七段从浏览器提取的完整 TSX 对实际生产导入的类型检查通过。
- Properties 仅在当前 Docs 会话保留挂载。实际切到 Accessibility 再返回后，参数、点击计数及代码展开状态保留；隐藏面板同时具有 `hidden` / `inert`，计算样式为 `display:none`，参数控件不在无障碍树中。代码展开/收起时 iframe 高度从 1,489px 恢复到 1,202px；最终左右留白各 16px。900×786 manager 下 Properties 文档宽度/scrollWidth 均为 489px，680px 参数表只在其 457px 区域内横滚，页面没有水平溢出；临时视口覆盖已恢复。
- Overview 按总览 → 用法 → 组成 → 使用建议 → 示例排列，补充图文、禁用与真实 `a href` 组合。实际 Enter 激活链接后，焦点到达同一示例 iframe 的目标段落，父 Docs 未导航；窄布局示例宽度/scrollWidth 均为 487px。无障碍说明明确键盘、命名、禁用/链接责任、4.5:1 / 3:1 的适用范围，以及既有 blue/slate primary 白字约 3.7617777:1 的缺口；未声称所有变体/状态或整页 AA 通过。未迁移 Input 的原布局和手动输入回显正常，两个页面浏览器错误记录均为空。
- 最终 `pnpm verify:design` 通过 101/101：100 个组件故事（88 桌面、12 H5）加 1 项真实断点回归，含 Button 7/7；类型、静态构建、维护表/token/icon 与真实 palette 检查通过。五个变更 TS/TSX 文件 ESLint、diff 空白检查通过，独立复核无剩余 P1/P2。未修改 worker、超时、断言强度或预算。
- 首次 Button 定向因新导入 `storybook/theming` 被晚发现而触发优化器 reload，7 个故事发生模块加载失败；显式加入既有 `optimizeDeps.include` 后定向 7/7 通过。后续静态检查发现新增 Copy 测试误用了 Playwright 的 `exact` 选项及未使用参数，已按 Testing Library 查询类型和 lint 修正。完整运行另曾出现未修改 Dropdown Menu 的菜单可见性断言失败（其余 100/101 通过）；原配置单跑 1/1 与完整 101/101 随后通过，初次失败原因未确定，原始日志保留，不将其写成已消除的时序问题。
- 与本轮基线 `969ce353` 比较，453 份生产源码、资源与 token 的 SHA256 全部一致，原有 Default、Variants、Sizes、KeyboardAndDisabled 四个故事定义逐字一致。没有修改生产 API、六变体、八尺寸、默认外观、原生组件、依赖或交互协议；本轮没有新增 Xcode Preview、模拟器或真机验收。
- 完整通过日志为 `/tmp/memocard-button-docs-complete-verify-design-accepted.log`，初次加载失败保留在 `/tmp/memocard-button-docs-unified-targeted.log`；静态失败为 `/tmp/memocard-button-docs-complete-verify-design.log` 与 `/tmp/memocard-button-docs-complete-eslint.log`，Dropdown 失败为 `/tmp/memocard-button-docs-complete-verify-design-final.log`。最终 lint / 代码类型检查日志为 `/tmp/memocard-button-docs-complete-{eslint-final,snippets-final}.log`；截图、AX 读回数据、实际复制代码及指纹位于 ignored 的 `build/verification/button-docs-complete/`。这些是本机辅助证据，远程 CI 以 PR #52 最新 head 为准。

## Button 文档分页与参数预览（2026-10-20）

- Button 专属 Docs 按 Astryx 的 Overview、Properties、Accessibility 分页。Overview 居中展示 MemoCard 原有六种变体，随后展示八种尺寸、用法、组成与使用建议；Canvas 代码默认收起。按用户可见复核意见去掉总览灰底和重复的内层圆角边框，只保留 Storybook 的外层预览框，生产按钮外观保持；根据后续可见意见将总览、尺寸、用法与键盘示例统一为 Docs 内水平、垂直居中，保留原 Canvas 布局。Properties 移除组件额外的 16px padding，仅保留 iframe 单层留白；真实 DOM 测量左右均为 16px。三个 Overview 示例的居中偏差为水平 0.25px（clientWidth 的子像素取整）、垂直 0px。其他试点继续使用原来的纵向模板。
- Properties 的六个带标签控件与真实生产 Button 位于同一隔离 iframe；修改 variant、size、children、type、aria-label、disabled 即时更新预览，Reset 恢复参数和内存点击计数。图标尺寸显示真实 Search，动态 JSX 使用 JSON 字符串表达式保留引号、花括号与尖括号；从真实 Docs 读取的文字、图标两段完整代码对实际生产导入的类型检查通过。新包装器关闭无效的外部 Canvas Controls，生产 API 表维持真实契约。
- 可见验收发现固定 540px iframe 会在窄布局展开代码时裁切；仅 Properties 开启 `docs.story.autoHeight`，按同源自然内容根的 ResizeObserver 调整高度，加载与切页时清理。实际复核代码展开时 API 下移、收起时高度恢复；其他故事保留固定高度和既有 document、存储与数据隔离。
- `pnpm verify:design` 最终通过：99 个故事（87 桌面、12 H5）加 1 项断点回归，共 100/100；类型、静态构建、维护表/token/icon 与真实 palette 检查通过。3 个变更 TSX 文件 ESLint 和 diff 空白检查通过，独立审查无 P1/P2。首次完整运行 99 个组件故事通过，既有断点用例在原 15 秒上限超时；未改源码或上限，单跑 1/1（1.04 秒）及完整原配置 100/100 随后通过，未确定初次超时原因。去灰底后静态构建和 Button 定向 6/6 通过；最终移除内层装饰后的静态构建与可见复核通过，后续居中与间距修正后再次完整 `pnpm verify:design` 100/100 通过，不将视觉调整视作新增交互覆盖。
- 真实 Storybook Docs 已完成 Overview → 方向键 Properties → Accessibility、参数修改/禁用/重置、图标名称与当前代码同步；键盘激活后 Tab 跳过禁用按钮并到达“下一项”。代码默认收起，六种变体和八种尺寸各在对应区域展示一次。未迁移 Input 的原布局及手动输入回显正常；最终导航浏览器错误记录为空。
- 453 份生产源码、资源与 token 指纹未变化；原有 Default、Variants、Sizes、KeyboardAndDisabled 四个 Button 故事与本轮基线逐字一致。未改生产组件、原生组件、依赖或交互协议。本轮未执行新的 Xcode Preview、模拟器或真机验收。
- 日志为 `/tmp/memocard-button-tabs-{targeted,verify-design,breakpoint,verify-design-final,no-gray-build,no-gray-tests,final-build,centered-tests,complete-final}.log`，截图、AX、真实代码和指纹位于 ignored 的 `build/verification/button-docs-tabs/`。初次超时保留在 `verify-design.log`，完整通过在 `verify-design-final.log` 与最终 `complete-final.log`；这些是本机辅助证据，远程 CI 以 PR #52 最终 head 为准。

## 组件使用文档试点（2026-10-20）

- Button、Input、Dialog、Note Search 复用一个 Storybook Docs 模板，增加用途、默认实际示例与最小生产代码、组成、使用建议、其他状态、API、无障碍和平台差异。Button 新增单按钮 Default；原有 14 个故事定义（含 args、play 和时限）与 main 逐字一致。未引入 MDX、组件注册表、运行时依赖或第二份组件维护清单。
- Button 显式列出 8 项常用生产参数，Input 列出 13 项；Dialog 的生产组合契约与示例 onSave 分开，Note Search 完整列出 7 个生产 props，并将 initialOpen 等示例控制项单列。Controls 只开放对当前故事真实生效的参数。独立审查曾发现 Button 的默认 type 文案错误；按已安装 Base UI useRender 的 renderTag 实现修正为默认路径提供 type="button"，提交需显式 submit，修复后独立复核无 P1/P2。未修改生产 Button 行为。
- `pnpm verify:design` 通过：97 个故事（85 桌面、12 H5）与 1 项断点回归，共 98/98；类型、静态构建、维护表/token/icon 及真实 palette 检查通过。没有修改 worker、断言、超时或预算。13 项跨 project 文件过滤不是跳过故事；报告中的 98 项测试全部执行并通过。4 段完整使用代码通过虚拟 TSX 文件对实际生产导入的类型检查，没有创建临时生产源码；6 个变更 TSX 文件的 ESLint 通过。
- `pnpm --filter @memocard/ui build` 与 `pnpm check:bundle` 通过。285 份指定 Web/原生源码、资源与 token 文件，以及 164 份生产构建产物，与实施前逐一 SHA256 一致，无修改；生产移动首页仍为 1,335,281 / 1,335,296 bytes raw。生产构建原有大 chunk 提示保留。改动仅在 Storybook 与设计文档中，不将此轮计作 Xcode Preview、模拟器或真机验收。
- 真实 Storybook Docs 已核对四个试点的说明、生产代码、参数表和单次主示例：Button 的 variant/size/type 可见且默认值正确，Input 手动输入后回显一致；Dialog 实际打开、Escape 关闭，在退出过渡完成后焦点返回触发器；Note Search 输入“计划”、方向键选中“计划清单”、Enter 后回调显示 search-checklist，关闭后焦点返回“返回搜索”。Canvas 将 Button 的 variant 调为 outline、size 调为 lg，控件和实际按钮更新，随后 Reset controls 恢复默认，没有保存故事改动。
- 全局 Docs 去重仅增加 Stories.includePrimary=false。未迁移的 Select 主故事和 Small 各出现一次；手动将首个选择框改为深色时，另外四个示例仍为浅色。Foundations Effects 的 Default、Dark、Reduced Motion 各出现一次，深色内容保持在独立 iframe 中，外围 Docs 仍为浅色。Docs 仍停止自动 play，手动交互、主题和数据隔离保留。
- 初次在并行静态构建期间打开开发服务，观察到 4 条 Storybook manager UniversalStoreFollowerTimeoutError；原始日志保留。完整构建后通过新导航完成上述检查，后续错误为 0，保留 1 条 Storybook 11 的 PopoverProvider ariaLabel 升级提示；没有修改产品代码或根据一次后续通过判断初次错误根因。首次 Dialog 关闭读取仍处于退出动画中，最终按过渡完成后的 DOM 和焦点确认关闭，不放宽原有交互测试。
- 本机日志为 `/tmp/memocard-component-docs-{verify-design,snippets,eslint,production-build,bundle}.log`，可见截图、AX 快照和源码/产物指纹位于 ignored 的 `build/verification/component-docs-pilot/`。这些文件作本机辅助证据，跨机器应重跑维护中的故事与设计门禁；远程 CI 以新 PR 的最终 head 为准。

## Foundations 颜色状态、排版与动效边界（2026-10-19）

- 本轮只扩展现有 Foundations 故事、独立浏览器测试配置和维护文档。默认外观、生产 CSS/Provider、token、原生组件及交互保持；不新增平行主题或排版规范。
- colors 共 5 个代表故事：默认浅/深、浅色 blue/slate、深色 teal、H5；读取 35 个生产语义色并测量 22 组配对（13 组语义、9 组标签）。其中 20 组普通文字使用未舍入的 4.5:1，`accent-text` 的当前固定图标按非文本 3:1，另 1 组 TabsList 容器色对只作诊断；禁用态不并入普通文字结论。配合真实 Button 的 hover/focus/disabled、Input 的输入/invalid、Tabs 的选中/键盘状态，检查实际渲染。浅色 blue/slate 的 primary 配白字实测约 3.7617777:1，作为既有普通文字 AA 问题保留，不修改默认外观。Tabs 容器约 4.4648:1 不能直接当作真实 Tab 文字缺陷，需以 Trigger 实际绘制颜色为准。颜色诊断故事通过不等于全部颜色 AA 通过。colors 定向 5/5 通过，日志 `/tmp/memocard-foundations-colors-final.log`；初版 synthetic hover 未触发真实 `:hover`，改用 Vitest locator 的实际指针悬停。临时将该动作 no-op 的负向 Default 检查确实失败，恢复后原样通过，日志 `/tmp/memocard-foundations-colors-hover-negative.log`。
- effects 增加深色图标/阴影/焦点和生产 Sheet，自动测试通过 Playwright 临时切换真实 `prefers-reduced-motion` 媒体偏好，比较常规与 reduce 的实际 computed 动画/过渡时长，验证关闭/Escape/焦点恢复，并恢复媒体偏好；不以更换类名或伪造 CSS 模拟系统设置。Canvas 遵循当前浏览器/系统偏好，故事名称本身不代表浏览器已进入 reduce。effects 定向 3/3 通过；临时将媒体模拟命令改为 no-op 的负向检查在实际 matchMedia 仍为 false 时失败，恢复配置后原样 3/3 通过，未改生产 CSS。日志为 `/tmp/memocard-foundations-motion-negative.log` 与 `/tmp/memocard-foundations-effects-restored.log`。
- typography 共 4 个故事：保留默认 16px → 18px → 恢复；紧凑边界 14px / 1.6 / 60 / 1em、宽松边界 18px / 1.9 / 90 / 2em 来自生产 options，初始值与交互均经过既有 parseTypography / TypographyProvider。检查实际字号、行高、段落 margin、阅读宽度变量消费与真实文章尺寸，验证调宽确实增宽、调小段距确实缩小，以及恢复默认。长中文/英文段落、列表、长链接与代码使用生产 Typeset；真实 H5 390×844 下紧凑、宽松和恢复三种状态均断言页面/样本不发生水平溢出，长代码沿既有规则在自身横滚。
- 排版定向 Chromium 4/4 已通过（3 个桌面、1 个 H5）；本机日志 `/tmp/memocard-foundations-typography-targeted-final.log`。初轮 Storybook 类型检查曾被并行动效 command 类型声明拦住，最终 `typecheck:storybook` 已通过，日志 `/tmp/memocard-foundations-typography-typecheck-final.log`；`pnpm verify` 已通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，生产移动首页预算仍为 1,335,281 / 1,335,296 bytes raw。完整 `pnpm verify:design` 已通过：97/97（84 个桌面 1024×900、12 个 H5 390×844 故事及 1 项真实断点回归），包括类型、静态构建、维护表/token/icon 检查和真实 palette 回归，日志 `/tmp/memocard-foundations-verify-design.log`。未改 worker、超时或预算；远程 CI 以新 PR 最终 head 为准。可见 IAB 已检查排版紧凑 → 宽松 → 默认 16 / 1.6 / 90 / 1em，及 effects 深色生产 Sheet 打开、Escape 关闭与入口焦点恢复；手动窗口不代替自动视口断言。Storybook manager 的 H5 Canvas 曾因附加面板把可见高度压到 298px，初版高度断言失败；现仅在浏览器测试模式断言完整 844px 高度，manager 仍检查真实 390px 宽度和全部溢出边界。自动项目继续逐项验证真实完整视口，未修改视口配置或溢出断言。修正后真实 manager 重新运行的 Interactions 已显示 PASS，并手动切到 18 / 1.9 / 90 / 2em；H5 可见截图为本机 `build/verification/foundations-state-coverage/typography-h5-visible.png`。
- 最终生产构建后，614 份 Web 源码/产物、iOS 源码/资源及 token 文件与实施前逐一 SHA256 一致，无新增/删除/修改，证据为本机 `build/verification/foundations-state-coverage/production-parity.json`；可见 colors blue/slate 的诊断、实际输入/Shift+Tab 焦点返回、方向键切到已固定也已完成，截图 `colors-state-visible.png`。这不代替远程 CI。未覆盖全部 palette/neutral 组合、全部字体字形/加载失败、所有组件/色对、整页 WCAG、旧浏览器或 iOS Preview/模拟器，本轮不重用前轮平台验收为新覆盖。

## 编辑器与原生页面外壳（2026-10-19）

- 新增真实 Editor 的 5 个故事：标题/正文编辑与自动保存、保存失败/重试、保存中禁用、只读、H5 失败/重试；调用方通过现有 `EditorHandle.finish()` 返回真实 NoteCollection，再次打开通过 `getNote` 读回。断言同时检查输入保留、恢复草稿与已提交笔记分离、重试载荷一致、提交版本、回调和无重复写入。bridge 只接受指定内存笔记、binding、路径及当前版本，无真实笔记库 fallback。
- 新增真实 NativeMainChrome 的 Collection / Detail / Busy / Dark Large 四个独立 `#Preview`。仅 DEBUG 预览 host 注入明确标识的只读占位正文；普通 App 仍使用原 WebView，Release 保留原渲染路径。12 项新原生检查覆盖布局、固定、返回、busy/旧 instance/未知动作拒绝，以及真实 hosting view 中有 UINavigationBar、无 WKWebView（含未注入正文的预览 host）。原有 42 个字段、6 个订阅场景、3 个 UIKit 输入、15 个预览 guard、2 个交互闭环和 7 个逐字输入断言仍通过。
- 首轮 Editor 导入被 Vite 的晚发现依赖重优化打断；仅在独立 Storybook 配置中补齐实际日志列出的 19 个依赖，没有改生产构建配置。定向首轮曾有一次 ResizeObserver loop 提示，保留记录，后续单项及完整运行未复现，未确定其根因。清除生成的依赖缓存后，88 个故事全部通过，既有断点用例在原 15 秒上限超时；原样单独运行 1/1 通过（1.13 秒），最终完整 `pnpm verify:design` 89/89 通过：78 个桌面 1024×900、10 个 H5 390×844 故事和 1 项真实断点回归。未修改断点用例、worker、等待上限或断言；并行构建与超时的因果关系未经确认。类型、静态构建、组件维护/token 映射、token/icon 与真实 palette 检查全部通过。
- `pnpm verify` 通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，类型/lint/生产构建与全部资源预算通过；既有编辑器 Hook 警告和大 chunk 提示保留。移动首页仍为 1,335,281 / 1,335,296 bytes raw，未提高预算。原生 probe 的 Debug 构建与独立 iOS arm64 Simulator Release 构建成功，Release 符号中无 MainChrome/Surface 预览实现；工程文件未改。
- Storybook 实际 Canvas 手动输入“Storybook 标题验收 / Storybook 正文验收”，观察保存失败时内容保留，点击真实“重试保存”后集合显示新值，再打开读回一致。使用现有 Core embed 模式暂停自动 play 以便手动操作；手动窗口尺寸不代替上述浏览器视口断言。Xcode Canvas 四个入口均实际渲染，Live Preview 通过真实原生固定、系统页面菜单/新建和返回显示对应反馈；Canvas 内层 AX 快照滞后时按新截图坐标操作，没有把失效 AX 点击算作成功。
- iPhone 18 Pro / iOS 27.0 使用独立 `dev.divikwu.memocard.editor-probe` bundle，复用真实 App、Editor、EditorSession、WKWebView 和原生 Chrome。仅数据响应为严格限定笔记/binding/版本的内存 fixture，原生 uiReady/updateNativeSurface 仍走真实 handler；修改后的保存持续失败，直至实际“重试保存”点击。首轮保存后重开触发了隔离 fixture 未清理已提交草稿造成的旧版本冲突，红审计已保留；按真实 Store 的匹配提交清理语义修正 fixture，5 项草稿匹配自检通过，未放宽版本 guard。最终重新可见完成标题 EditorQA、正文首段 BodyQA 编辑、失败保留、原生返回再次失败仍停留、重试成功返回真实集合及重新打开读回；其余原段落保留。最终审计为失败 3 次、显式重试 1 次、成功保存 1 次、匹配草稿清理 1 次，草稿为空、页面错误/JS 错误/拒绝请求均为 0。真实 App 的 170 份已安装文件、58 份 QA 库文件、bookmark/layout 及 395 份 Web 源码/产物均与基线一致。验收后恢复关闭 Capture Keyboard、卸载独立 probe 并重新打开原 App；不将内存成功视为磁盘持久化验收。
- 独立验收入口初版试图重新定义 WebKit 的不可配置 `window.webkit`，曾导致空白页；仅修正 ignored 测试入口以包装其可配置 handler，之后真实 App 正常渲染。该问题没有进入生产源码。手机键入期间的候选栏内容不作为输入真值，以真实 DOM 只读审计和画面核对；本轮不声明中文 IME、所有富文本节点、冲突解决、系统选择器、iCloud、旧系统或真机覆盖。
- 本机日志为 `/tmp/memocard-editor-{design-final,verify,native-chrome-probe-final,release-build}.log`，截图与隔离审计位于 `build/verification/editor-preview/`。这些 ignored 文件只作辅助证据；跨机器重跑维护中的故事和 harness，远程结果以交付 PR 最新 head 为准。

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
