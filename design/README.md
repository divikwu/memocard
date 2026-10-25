# MemoCard 设计规范 v1

本目录是全平台设计规则的现行入口。规范覆盖桌面 Web、H5、本机 Web、macOS WebView，以及 iOS 原生外壳与内嵌 Web；首个完成实现和预览闭环的组件为侧栏。

- [基础规范与维护边界](foundations.md)
- [系统性 token 定义规范](token-system.md)
- [Token 工程维护与集成](token-engineering.md)
- [原生排版工程说明](native-typography.md)
- [完整 token 覆盖清单（生成）](token-coverage.generated.md)
- [组件归属表](component-ownership.md)
- [已使用组件维护表](component-inventory.md)
- [组件使用文档结构与维护方式](component-docs.md)
- [新旧 UI 的 Storybook 入口](ui-next.md)
- [新版整页状态与吉祥物 Preview](ui-next-preview.md)
- [Token 消费映射](token-consumption.md)
- [侧栏规格与验收清单](components/sidebar.md)
- [搜索与快速记录场景及验收边界](components/search-capture.md)
- [笔记集合与正文预览场景及验收边界](components/note-browser.md)
- [编辑器与原生笔记页外壳场景及验收边界](components/editor.md)
- [可移植 token 对照表（生成）](TOKENS.generated.md)
- [本轮验证记录](validation.md)

## 唯一维护来源

| 内容 | 权威来源 | 消费方式 |
| --- | --- | --- |
| 圆角选项、侧栏静态基准 | `tokens/sidebar.tokens.json`（DTCG） | Style Dictionary 生成 CSS、TS、Swift 和对照表 |
| 动态颜色、强调色、中性色、Web 字体和语义映射 | `apps/ui/src/features/theme/tokens.css` | `styles.css` 导入；CSS 计算后经现有 palette bridge 传原生 |
| Web 动效时长与缓动 | `apps/ui/src/features/motion/tokens.css` | 默认 Tailwind 过渡映射、组件工具类与 CSS 引用；保持减少动态效果规则 |
| 标签与标注领域颜色 | `apps/ui/src/tag-colors.tokens.css`、`import-layout.tokens.css` | 原领域样式入口导入，Web 与原生所需子集共享 |
| 外观选项与默认值 | `features/theme/preferences.ts`、`ThemeProvider.tsx` | 保留设备级偏好、存储格式与运行时外观写入 |
| 笔记默认字体回退 | `features/typography/tokens.css` | `styles.css` 导入；TypographyProvider 覆盖用户偏好 |
| 笔记字号、行高、阅读宽度与段距 | `features/typography/preferences.ts`、`TypographyProvider.tsx`、`typeset.css` | 既有偏好解析为笔记正文变量，不改变导航与工具栏 |
| 原生安全区与浮层定位输出 | `WebView.swift` 的 scrollInsets、锁定的 Base UI Positioner | 逐项登记既有运行时变量及消费边界，不设置固定的全局定位默认值 |
| 系统控件尺寸、材质与行为 | 平台系统和平台适配代码 | 使用系统 API，避免复制系统内部数值 |
| 品牌图形 | Web Lucide 依赖与 `scripts/generate-sidebar-icons.mjs` | 同源导出原生侧栏图标 |

每项设计值只有一个维护位置。v1 没有复制全部颜色到 Swift，也没有迁移全部历史 CSS；未来迁移一个类别时，必须同时删除其旧定义并更新此表。

完整体系按九类登记基础标尺、语义、组件和平台职责。CSS 族的类型、主题轴、消费入口、运行时偏好输出与组件/平台所有权维护在 `tokens/registry.json`；默认表达式从权威源码生成到覆盖清单。组件局部度量与平台行为可以继续由各自源码拥有，登记覆盖不代表全部提升为全局变量。选型继续为 shadcn/ui + Base UI + Tailwind，保留现有外观与交互。

Tailwind `@theme` 接口参考 Astryx 语义命名：正文为 `text-primary`，强调按钮为 `bg-accent-bg text-on-accent`。组件、Storybook 和预览入口已统一迁移；底层 CSS 与原生 palette 值保持。新旧名称对应及扩展角色见 [工具类映射](token-engineering.md#工具类映射)。

覆盖清单还自动索引生产依赖图与 CSS、工具类/样式类引用、局部覆盖、动态 palette 和 Apple 尺寸消费，校验原生安全区输出及上游定位变量。代表入口说明用途，完整逐文件依赖以生成索引为准；潜在依赖不等于全部运行状态已验收。

## 日常工作流

1. 修改 token 源或现行组件规格，更新 registry / 消费映射，执行 `pnpm tokens:build`；生成跨端尺寸和完整覆盖清单。
2. Web 执行 `pnpm --filter @memocard/ui storybook`，原生在 Xcode 打开 `NativeSidebar.swift` 或 `NativeChrome.swift` 的 Canvas。
3. 修改颜色 CSS 后执行 `pnpm palette:build`；它通过锁定的 Chromium 和生产 `readIOSPalette()` 采样默认浅/深色，生成仅 Debug 使用的 Swift fixture。普通 token 构建不依赖浏览器。
   采样的强调色、中性色和圆角来自生产 `DEFAULT_APPEARANCE`；无变化时保留 Swift 文件时间戳。
4. 执行 `pnpm verify:design` 和相关组件/bridge 回归，再在真实 App 验证。生成文件随源文件一起提交。
5. 升级 Lucide 或修改侧栏图标映射后执行 `pnpm icons:build`；`icons:check` 逐字节检查 SVG 与 Xcode 资源 metadata，并已接入设计 CI。
6. 新增生产可达组件时，先登记维护表中的平台职责、状态契约、token 族、验证入口与缺口。`check:design-inventory` 从 Web 生产入口追踪运行时模块，检查遗漏/失效路径，并核对全部可移植 token 的消费说明；原生组件家族与系统职责仍需人工审查。此门禁及其反例测试已接入设计和 release 验证，登记完整不等于所有状态都有独立故事。

生成文件禁止手改。`tokens:check`、`icons:check`、`palette:check` 只检查，不覆盖现有文件；三个生成命令都在内容相同时保留时间戳。设计 CI 的 `test:palette` 用一次真实采样同时验证 fixture 漂移与只读／mtime 行为。Storybook 的 Canvas Controls 用于预览组件参数；Docs 使用隔离的静态示例与只读参数表，避免多个交互脚本争抢焦点。正式设计改动回到源文件，不自动写回生产布局。

平台输出只暴露各端实际消费的值。基础 spacing 用于别名解析，原生专用的缩进与字号不额外生成 Web CSS 变量，避免把开发规范和未使用的变量带入生产包。

## 工程边界

Storybook、故事、模拟数据和浏览器测试只用于开发，不进入生产入口或原生 Web 资源。整页状态与流程验收统一使用 `apps/ui/ui-next/preview`，入口与覆盖范围见[新版 Preview](ui-next-preview.md)。旧版 Preview 的页面、配置和入口已移除；角色创作源与历史原型说明见[设计归档](mascots/README.md)。场景数据和吉祥物素材分别由 `ui-state-fixtures` 与 `mascot-fixtures` 共享维护。原生 Preview 使用生产组件及隔离的 `NativeHost(previewSurfaces:)`，不连接真实笔记库或启动服务。

Storybook 的 Foundations 包含尺寸/间距、完整 CSS 语义色与标签色、真实 Provider 驱动的界面/笔记排版、图标/阴影/焦点与动效边界。高频基础组件直接使用生产 Button、Input、Textarea、Select、Switch、Tabs、Dialog、Dropdown Menu、Popover、Tooltip 和 Sheet，分别记录适用状态与键盘/关闭/焦点行为。侧栏仍保留组合故事。搜索与快速记录包含生产组件的业务 Story 和真实原生 overlay 的独立 Preview，使用隔离数据反馈输入、关闭与保存结果。NoteCollection 与 NotePreview 的业务 Story 覆盖集合浏览和内容预览，iOS 复核共用组件的实际 WKWebView 路径；场景操作和边界见对应组件说明。其他业务组件继续使用维护表中登记的现有 fixture/回归，未把它们声明为已完成独立 Story。

Foundations 的 Docs 以 All tokens 总览与 Color、Elevation、Icons、Motion、Shape、Spacing、Typography 分类展示。Sizing 归为隐藏的尺寸验收参考，原 Docs / Reference 路由和测试保留；组件尺寸与侧栏密度说明分别归对应组件文档和 Sidebar 规格。统一使用大标题、分区表格与当前模式色样，以及宽屏固定侧目录；窄屏目录自然换行，页面不横向溢出。颜色诊断、排版偏好和完整动效回归保留 Canvas；Motion Docs 提供一处手动演示，不自动播放测试。

All tokens 展示非适配层 CSS 定义与全部尺寸基准；表格只保留名称、当前模式值与预览，取消名称展开与元数据展示；按钮和字体示例只在分类页展示，焦点检查保留在 Canvas。工具类映射、运行时输出、上游定位变量、所有权与使用教程移到 [Token 工程维护与集成](token-engineering.md)，完整定义继续保留在生成清单。所有分类页均移除 `Contract / Guidance` 表格，原来只有工程信息的 Layering、Responsive 页面撤下。

表格、色块及展示容器随工具栏圆角设置变化，`none` 为直角。Shape 中的固定圆角基准仍按各自定义展示；派生圆角按当前基准及原有公式解析，不因文档展示而修改生产定义。

All tokens 的侧栏只保留文档入口；Default、Dark、Mobile 使用既有 `!dev` 标签隐藏导航，但保留 `test` 标签和交互断言。真实 Provider 的 Live Palette 场景归入 Color 分类，原 `foundations-tokens--live-palette` 保留为共享夹具的隐藏兼容入口，继续验证强调色、中性色、恢复默认和原生 palette 同步。

Color Docs 的语义色按基础表面与文字、操作与状态、边界与反馈、侧栏、图表五个独立分区和表格展示，背景与前景相邻排列；Tag、Callout、Palette 保持独立。原 `foundation-colors` / `foundation-title-colors` 锚点继续定位首组，All tokens 保留完整总览表。

Color 侧栏只显示 Docs；Diagnostics（原 Default）、Dark、Blue Slate、Dark Teal、Mobile 与 Live Palette 均隐藏导航，保留直达路由。所有原有 story ID、主题组合、设备标签与测试继续保留。 Diagnostics 只展示主题摘要与 22 组配对结果表；按钮、输入与 Tabs 的交互检查保留在隐藏的 State Regression 五种原有组合中；测量原理与来源说明见工程维护文档，完整色样放在 Docs，35 个颜色角色的解析检查保留在内部测试夹具中。

Elevation 侧栏只保留 Docs，原 Diagnostics / Regression / Dark / Reduced Motion 均隐藏导航，全部 ID 和测试保留。抽屉键盘交互的可见入口归入 Sheet / Interaction，系统动效偏好演示归入 Motion Docs；与旧入口共享原夹具，避免维护两套实现。明暗模式继续由工具栏切换。

Icons 侧栏只保留 Docs，Reference 保留原 ID 和测试并隐藏。目录自动收集生产入口可达代码中的 Lucide 运行时引用，合并原生侧栏映射并按标准名称去重，网格只展示图形和名称；未使用导入、测试与故事不纳入。启动/构建时生成并校验，完整来源与使用边界见[图标工程维护](token-engineering.md#图标目录与跨端维护)。

Motion 侧栏只保留 Docs，Reference / Reduced Motion 的 ID、测试和完整夹具保留并隐藏。页面直接读取生产源码与已安装 Tailwind 的时长、缓动和减少动态效果规则，共用基础表格展示，并嵌入一处随系统偏好变化的真实 Sheet 演示；不新增全局动效 token 或改动生产动画。

Shape 侧栏只保留 Docs，Reference 的原 ID 和测试保留并隐藏。页面分为「圆角选项」与「当前主题圆角」，两表统一为 Token / Value / Preview 三列；当前基准与源码中的派生表达式随结果一起展示，交互区域圆角在第二表内单独分组。预览统一使用 64×56px，窄屏使用 56×48px，仅放大展示框，不改变实际圆角值。固定档位、主题派生公式及组件局部规则保持原义。

Spacing、Typography、Size & density 均只保留 Docs。Spacing / Sizing 的 Reference，以及 Typography 的 Default / Compact Boundary / Spacious Boundary / Mobile Responsive 隐藏导航，保留全部原 ID、test 与 mobile 标签和原交互断言。侧栏尺寸采用 Token / Value / Preview，按钮尺寸以同列布局展示生产组件；Spacing 采用两列横向标尺。Typography 合并字体角色定义与样本，补齐现有可选字体和生产代码使用的字号、字重、行高，以及笔记与原生基准；去掉指向隐藏测试场景的跳转。原 ID、token 定义和完整覆盖清单持续保留。

Typography 的使用目录由 `typography:build` 自动读取生产可达代码、现有字体选项与锁定上游定义，`typography:check` 和 `test:typography` 验证；源码范围、相对单位与系统字体职责见[排版工程维护](token-engineering.md#typography-使用目录与展示范围)。原 Provider 宽度映射、Typeset 层级、token 定义和完整覆盖清单保留；补齐局部变量消费、斜体、等宽选项与行宽标签的一致性，字体样本改为逐行按需加载。Web 字号以浏览器计算的 px 为主值，同时保留原始表达式及根字号/父级字号基准，组件局部值单独说明；原生 pt 基准独立展示。

`pnpm tokens:build` 同时生成 [Storybook 结构化目录](token-coverage.generated.json)，与 Markdown 覆盖清单使用同一次解析和校验。它是只用于文档的派生输出，禁止手改；不会进入产品依赖图。色样通过隔离、无脚本的文档加载生产 CSS，仅解析工具栏当前模式与配色；颜色、阴影、圆角和字体值随外观更新，不切换外层主题、不读取或写入真实设备偏好。展示方式参考 [Astryx Foundations](https://astryx.atmeta.com/docs/tokens)，定义和值继续来自 MemoCard。

Foundations 的 colors 展示生产前景/背景配对，真实 Button、Input、Tabs 状态保留在隐藏回归场景；对比度诊断按实际文字或图标用途分类，既有未达标项保留在验证记录中。标注背景、文字与菜单色样由同一 token 文件维护，Color Docs 展示全部三组定义，隐藏 callout colors 场景验证原有浅深色值、变量消费与菜单选择。typography 从生产选项读取字号、行高、阅读宽度和段距的边界，使用真实 Provider 交互调整、恢复默认及 H5 阅读样本；不另建排版解析器。effects 补充浅/深色和真实浏览器 Reduce Motion 媒体偏好下的生产 Sheet 检查，Canvas 仍遵循当前系统偏好。代表场景、已知问题与执行结果见 [验证记录](validation.md)，不声明全部 palette、字体字形或组件状态已验收。

Storybook 的 Select/Switch/Tabs 与搜索实际使用的 Markdown 依赖在启动前显式预优化，避免虚拟故事首次发现依赖后刷新浏览器测试页。Storybook 10.6.2 的 iframe Docs 不传递 autoplay 参数；通过公开 Story block 覆盖与 Core embed 模式停止自动 play，手动交互保留，完整交互验收在 Canvas 与 Vitest 执行。相关依赖机制见 [Vite 依赖预构建](https://vite.dev/guide/dep-pre-bundling.html)；冷启动验收与热缓存复跑分开记录。

基础 token 与 Web / 原生组件实现分离；不新增跨端组件 DSL 或运行时 token 服务。Figma 同步、全量组件迁移及原生 Debug 目录留待有实际消费需求时推进。token 整理不作为性能改善证据。

侧栏的标签树索引、原生状态订阅及可复现性能基线见 [performance.md](performance.md)。性能计时与行为回归分别记录；CI 检查确定性扫描／通知次数和真实 bridge 行为，不设置依赖机器速度的毫秒门槛。

## 上游参考

- [DTCG 2025.10 格式](https://www.designtokens.org/tr/2025.10/format/)
- [Style Dictionary 平台输出](https://styledictionary.com/reference/hooks/formats/)
- [Base UI 样式](https://base-ui.com/react/handbook/styling)
- [Apple 系统控件与平台外观](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)

- [Typography 系统](typography.md)：基础标尺、笔记偏好、内容角色与跨端规则。
