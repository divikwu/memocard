# MemoCard 设计规范 v1

本目录是全平台设计规则的现行入口。规范覆盖桌面 Web、H5、本机 Web、macOS WebView，以及 iOS 原生外壳与内嵌 Web；首个完成实现和预览闭环的组件为侧栏。

- [基础规范与维护边界](foundations.md)
- [组件归属表](component-ownership.md)
- [已使用组件维护表](component-inventory.md)
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
| 动态颜色、强调色、中性色、Web 字体与外观选择 | `apps/ui/src/styles.css`、`features/theme/ThemeProvider.tsx` | CSS 计算后经现有 palette / rowRadius bridge 传原生 |
| 笔记字号、行高、阅读宽度与段距 | `features/typography/preferences.ts`、`TypographyProvider.tsx`、`typeset.css` | 既有偏好解析为笔记正文变量，不改变导航与工具栏 |
| 系统控件尺寸、材质与行为 | 平台系统和平台适配代码 | 使用系统 API，避免复制系统内部数值 |
| 品牌图形 | Web Lucide 依赖与 `scripts/generate-sidebar-icons.mjs` | 同源导出原生侧栏图标 |

每项设计值只有一个维护位置。v1 没有复制全部颜色到 Swift，也没有迁移全部历史 CSS；未来迁移一个类别时，必须同时删除其旧定义并更新此表。

## 日常工作流

1. 修改 token 源或现行组件规格，执行 `pnpm tokens:build`。
2. Web 执行 `pnpm --filter @memocard/ui storybook`，原生在 Xcode 打开 `NativeSidebar.swift` 或 `NativeChrome.swift` 的 Canvas。
3. 修改颜色 CSS 后执行 `pnpm palette:build`；它通过锁定的 Chromium 和生产 `readIOSPalette()` 采样默认浅/深色，生成仅 Debug 使用的 Swift fixture。普通 token 构建不依赖浏览器。
   采样的强调色、中性色和圆角来自生产 `DEFAULT_APPEARANCE`；无变化时保留 Swift 文件时间戳。
4. 执行 `pnpm verify:design` 和相关组件/bridge 回归，再在真实 App 验证。生成文件随源文件一起提交。
5. 升级 Lucide 或修改侧栏图标映射后执行 `pnpm icons:build`；`icons:check` 逐字节检查 SVG 与 Xcode 资源 metadata，并已接入设计 CI。
6. 新增生产可达组件时，先登记维护表中的平台职责、状态契约、token 族、验证入口与缺口。`check:design-inventory` 从 Web 生产入口追踪运行时模块，检查遗漏/失效路径，并核对全部可移植 token 的消费说明；原生组件家族与系统职责仍需人工审查。此门禁及其反例测试已接入设计和 release 验证，登记完整不等于所有状态都有独立故事。

生成文件禁止手改。`tokens:check`、`icons:check`、`palette:check` 只检查，不覆盖现有文件；三个生成命令都在内容相同时保留时间戳。设计 CI 的 `test:palette` 用一次真实采样同时验证 fixture 漂移与只读／mtime 行为。Storybook 的 Canvas Controls 用于预览组件参数；Docs 使用隔离的静态示例与只读参数表，避免多个交互脚本争抢焦点。正式设计改动回到源文件，不自动写回生产布局。

平台输出只暴露各端实际消费的值。基础 spacing 用于别名解析，原生专用的缩进与字号不额外生成 Web CSS 变量，避免把开发规范和未使用的变量带入生产包。

## 工程边界

Storybook、故事、模拟数据和浏览器测试只用于开发，不进入生产入口或原生 Web 资源。现有 `apps/ui/preview` 保留整页状态与流程验收职责。原生 Preview 使用生产组件及隔离的 `NativeHost(previewSurfaces:)`，不连接真实笔记库或启动服务。

Storybook 的 Foundations 包含尺寸/间距、完整 CSS 语义色与标签色、真实 Provider 驱动的界面/笔记排版、图标/阴影/焦点与动效边界。高频基础组件直接使用生产 Button、Input、Textarea、Select、Switch、Tabs、Dialog、Dropdown Menu、Popover、Tooltip 和 Sheet，分别记录适用状态与键盘/关闭/焦点行为。侧栏仍保留组合故事。搜索与快速记录包含生产组件的业务 Story 和真实原生 overlay 的独立 Preview，使用隔离数据反馈输入、关闭与保存结果。NoteCollection 与 NotePreview 的业务 Story 覆盖集合浏览和内容预览，iOS 复核共用组件的实际 WKWebView 路径；场景操作和边界见对应组件说明。其他业务组件继续使用维护表中登记的现有 fixture/回归，未把它们声明为已完成独立 Story。

Foundations 的 colors 将生产前景/背景配对与真实 Button、Input、Tabs 状态一起展示；对比度诊断按实际文字或图标用途分类，既有未达标项保留在验证记录中。typography 从生产选项读取字号、行高、阅读宽度和段距的边界，使用真实 Provider 交互调整、恢复默认及 H5 阅读样本；不另建排版解析器。effects 补充浅/深色和真实浏览器 Reduce Motion 媒体偏好下的生产 Sheet 检查，Canvas 仍遵循当前系统偏好。代表场景、已知问题与执行结果见 [验证记录](validation.md)，不声明全部 palette、字体字形或组件状态已验收。

Storybook 的 Select/Switch/Tabs 与搜索实际使用的 Markdown 依赖在启动前显式预优化，避免虚拟故事首次发现依赖后刷新浏览器测试页。Storybook 10.6.2 的 iframe Docs 不传递 autoplay 参数；通过公开 Story block 覆盖与 Core embed 模式停止自动 play，手动交互保留，完整交互验收在 Canvas 与 Vitest 执行。相关依赖机制见 [Vite 依赖预构建](https://vite.dev/guide/dep-pre-bundling.html)；冷启动验收与热缓存复跑分开记录。

基础 token 与 Web / 原生组件实现分离；不新增跨端组件 DSL 或运行时 token 服务。Figma 同步、全量组件迁移及原生 Debug 目录留待有实际消费需求时推进。token 整理不作为性能改善证据。

侧栏的标签树索引、原生状态订阅及可复现性能基线见 [performance.md](performance.md)。性能计时与行为回归分别记录；CI 检查确定性扫描／通知次数和真实 bridge 行为，不设置依赖机器速度的毫秒门槛。

## 上游参考

- [DTCG 2025.10 格式](https://www.designtokens.org/tr/2025.10/format/)
- [Style Dictionary 平台输出](https://styledictionary.com/reference/hooks/formats/)
- [Base UI 样式](https://base-ui.com/react/handbook/styling)
- [Apple 系统控件与平台外观](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
