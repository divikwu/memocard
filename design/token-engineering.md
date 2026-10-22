# Token 工程维护与集成

Storybook 的 All tokens 用于查阅名称、数值、色样与尺寸预览，表格仅显示工具栏当前亮／暗模式与配色下的值；分类页保留字体、按钮尺寸与动效演示；完整焦点与动效回归保留在 Canvas。本页承接工具类映射、运行时输出、维护归属和使用方式。

展示范围不改变定义范围。完整记录仍由 [registry](tokens/registry.json) 登记，[覆盖清单](token-coverage.generated.md) 与 [结构化目录](token-coverage.generated.json) 自动生成。当前登记全部 282 项静态 CSS 定义、13 项运行时输出、28 项可移植尺寸、17 项所有权契约和 4 项上游定位输出；Storybook 主表展示其中的 171 项非适配层 CSS 定义和全部尺寸基准。

标注的背景、文字和菜单样本统一在 `import-layout.tokens.css` 维护。文字 token 按浅深色覆盖，菜单 swatch token 沿用原有固定色值；默认仍消费 foreground。具体角色与消费者见 [Token 消费映射](token-consumption.md)，浅深色浏览器回归会覆盖实际变量，检查正文、标题和生产菜单确实读取这两组 token。

## 工具类映射

[theme/tokens.css](../apps/ui/src/features/theme/tokens.css) 的 `@theme inline` 将语义变量映射为 Tailwind 工具类。例如 `--color-primary: var(--primary)` 提供 `bg-primary` / `text-primary`，`--font-sans` 关联界面正文字体，`--shadow-overlay` 关联浮层阴影。

颜色适配层定义引用已有权威值，不另行维护一组默认色。它们仍列入覆盖清单的“公开 CSS 定义”，以 `adapter` 层标记；Storybook 不再重复展示对应色样。修改语义定义或映射关系时，继续验证依赖链、主题覆盖和生产消费者。

Elevation 分类页直接读取已安装 `tailwindcss/theme.css`：基础阴影为 `--shadow-2xs / xs / sm / md / lg / xl / 2xl`，内阴影为 `--inset-shadow-2xs / xs / sm`，轮廓投影为 `--drop-shadow-xs / sm / md / lg / xl / 2xl`。三组共用表头、列宽与预览布局；外/内阴影通过 box-shadow 展示，轮廓投影通过透明 SVG 的 filter: drop-shadow 展示，项目定义继续单列。16 项上游标尺不计入项目自有定义，也不重复放入 All tokens 项目目录。

项目表面与轻量控件阴影由 `theme/tokens.css` 维护；快速记录的聚焦表面与悬浮控件阴影由 `theme/capture.tokens.css` 维护，随 `quick-capture.css` 加载，避免将专用定义加入首屏 CSS。四个角色与浮层阴影一起列在「项目定义」。原数值与 Tailwind 标尺不完全一致，保持独立角色；重复消费者共享同一 token。表面使用 `shadow-(--surface-shadow)` 保留 Tailwind 的阴影与 ring 组合，组件 CSS 直接引用另外三个角色；聚焦表面与悬浮控件在 `.dark` 覆盖。Docs 的隔离采样器同时读取两份权威定义。具体消费入口见 [消费映射](token-consumption.md)。

Elevation 仅保留 Docs，原 Diagnostics 入口隐藏但 ID 和测试保留。键盘打开、遮罩、Esc / 按钮关闭及焦点返回的可见检查归 Sheet / Interaction；系统媒体偏好演示归 Motion Docs，完整时长对比保留在隐藏 Reduced Motion 回归。共享夹具与断言供新入口和旧 ID 调用；完整图标、阴影及独立焦点检查仍在隐藏 Regression / Dark / Reduced Motion 中执行，token 定义和覆盖清单不受影响。

## 圆角选项与主题派生

Shape Docs 的七个固定档位来自 [sidebar.tokens.json](tokens/sidebar.tokens.json)，Web / 原生按既有 px / pt 契约使用。当前主题圆角来自 [theme/tokens.css](../apps/ui/src/features/theme/tokens.css)，通过原有隔离采样器读取当前工具栏基准下的浏览器计算值；显示当前 --radius 基准，并直接从生成目录的源码声明展示派生表达式，不另写计算公式。两组定义不按同名后缀互相替代。

主题角色按 sm / md / lg / xl / 2xl / 3xl / 4xl 排列，交互区域的 `--hover-row-radius` / `--hover-action-radius` 在同表单独分组，保留独立默认值及局部覆盖职责。选择 none 仍使用原公式，例如 `--radius-xl` 为 4px；文档整理不改变生产圆角。Reference 用 !dev 隐藏，`foundations-shape--reference` ID 和 test 标签保留。

## 图标目录与跨端维护

Icons 只保留 Docs，原 `foundations-icons--reference` 使用 `!dev` 隐藏导航，ID 与测试资格不变。页面只显示图形和 Lucide 标准组件名；目录来自 [icon-usage.generated.json](icon-usage.generated.json)，禁止手改。该目录仅供 Storybook 使用，不进入生产依赖图，也不计入 token 定义数量。

[目录生成器](../scripts/build-project-icon-catalog.mjs) 复用从 main.tsx 出发的生产依赖图，排除测试、Storybook 与不可达文件，再使用 TypeScript 符号绑定检查 Lucide 命名导入的运行时引用。注释、字符串、类型引用、未使用的导入与被局部同名变量遮蔽的引用不纳入。根据已安装 Lucide 组件的规范名称合并别名，例如 MoreHorizontal / Ellipsis 合为 Ellipsis，XIcon / X 合为 X。遇到 namespace、动态导入或直接再导出时明确报错，需先扩展采集支持，不能静默漏项。

此清单表达生产可达模块的静态使用范围，包含不同界面与条件分支；不等于当前页面同时渲染的图标，也不模拟构建器对局部死代码的全部裁剪。逐图标消费者保存在生成 JSON 中，工程信息不放进展示网格。

原生侧栏消费 [generate-sidebar-icons.mjs](../scripts/generate-sidebar-icons.mjs) 的十项 bridge symbol → Lucide 映射，由 [NativeSidebar.swift](../apps/apple/Sources/NativeSidebar.swift) 读取生成的模板 SVG。目录复用这份映射并与 Web 名称去重，避免手写第二份名单。house / note.text / gearshape 等是桥接名，展示名称采用 House / Notebook / Settings2；原生系统菜单和工具栏继续使用 SF Symbols，不纳入 Lucide 目录。

侧栏图标视觉基准为 16px / pt、触摸命中基准为 44px / pt，分别由既有尺寸定义维护；Docs 的 24px 预览仅用于浏览。mask 使用 currentColor，随明暗和配色继承前景色，不改变生产图标尺寸或样式。

`pnpm icons:build` 同时生成原生资产与项目目录，`pnpm icons:check` 检查漂移，`pnpm test:icons` 保留原生导出测试并检查符号引用、别名去重、生成稳定性与漂移。Storybook 的启动与静态构建会自动运行生成；开发期间修改生产导入后运行 icons:build（或重新启动 Storybook）即可刷新目录。

## 动效规范与演示

Motion 只保留 Docs，原 Reference / Reduced Motion ID 和测试保留并隐藏。页面通过 [foundation-motion.data.ts](../apps/ui/stories/foundation-motion.data.ts) 的 raw 导入直接读取已安装 Tailwind 与当前生产源码，列出默认过渡、快速记录、Sheet 进入/退出、侧栏、手势回弹和图片加载的时长、缓动及来源。解析不到原定义时明确失败，不维护平行默认值；CSS 的 ease-out 关键字按原义保留，不转换为 Tailwind 的同名工具类。

减少动态效果表同样读取生产 CSS：全局动画/过渡缩短为 0.01ms，平滑滚动设为 auto；快速记录、手势回弹和图片加载保留各自 none 规则。ThemeProvider 在切换外观时临时停用过渡的实现继续由 Provider 维护，不新增全局动画参数。

Docs 使用 MotionExample 的精简展示，只显示系统媒体偏好与一处手动播放的生产 Sheet；不会自动播放，也不伪造系统偏好。完整旧夹具和媒体切换/时长/关闭/焦点断言仍供隐藏故事使用。页面回归通过浏览器真实 no-preference / reduce 媒体特性检查嵌入演示，具体抽屉交互展示继续在 Sheet。

## 外观与排版的运行时输出

界面字体由 [外观偏好](../apps/ui/src/features/theme/preferences.ts) 解析，经 [applyAppearance](../apps/ui/src/features/theme/apply-appearance.ts) 写入 `--app-font-heading` / `--app-font-body`。

笔记字体、字号、摘要字号、阅读宽度、行高与段距由 [排版偏好](../apps/ui/src/features/typography/preferences.ts) 和 [TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx) 管理。它们写入 `--note-body-font`、`--note-heading-font`、`--note-mono-font`、`--note-size`、`--note-summary-size`、`--note-measure`、`--note-leading`、`--note-flow`。与静态 CSS 同名的字体输出覆盖其回退定义，不是重复的权威来源。

类型、单位、默认来源和派生源码逐项见覆盖清单的“运行时输出（偏好与原生安全区）”。Storybook Typography 仅保留 Docs，显示字体角色、可选字体、通用字号/字重/行高；四项阅读偏好和宽度计算表在 [Typography 工程文档](typography.md) 维护，四项原生相关基准和完整 Swift 文字用法在 [原生排版工程说明](native-typography.md) 维护，不重复运行时维护表，也不展示测试场景跳转。界面字体随外观设置解析；笔记静态字体回退与真实 Provider 的运行时覆盖职责不合并。

Spacing / Sizing 的 Reference 和 Typography 的 Default / Compact Boundary / Spacious Boundary / Mobile Responsive 均使用 !dev 隐藏，原 ID、test 标签和 mobile 设备标签保留。Typography 的保存、选择边界、恢复默认、真实 390×844 视口与代码内部横滚仍在旧故事中执行；可通过 `pnpm --filter @memocard/ui test:storybook --project storybook-desktop --project storybook-mobile stories/foundation-typography.stories.tsx stories/foundation-spacing.stories.tsx stories/foundation-sizing.stories.tsx` 运行。只隐藏导航，不删夹具或重写断言。

Spacing Docs 保留全部六项逻辑基准。Size & density 不定义独立的全局密度规则，从 Foundations 侧栏隐藏；仅通过 Storybook manager 的 sidebar filter 过滤显示，原 `foundations-sizing--docs` / `--reference` ID、索引和测试标签保留，直接 URL 仍可访问。All tokens 保留 `foundation-sizing` 分区及十五项完整侧栏定义，源定义、registry 与覆盖清单不变。

尺寸说明归对应组件维护：Button Docs 已展示八种文字 / 图标尺寸，Input Docs 补充 Input 与 InputGroup 的组合尺寸，Textarea / Select / Tabs Docs 说明各自的最小高度或大小变体；侧栏行高、图标与命中区归 [Sidebar 规格](components/sidebar.md) 和其 Storybook Docs。跨端字号见 [原生排版工程说明](native-typography.md)；完整十五项侧栏尺寸的 Web / Swift 消费见 [消费映射](token-consumption.md)，默认数值仍由 [DTCG 源](tokens/sidebar.tokens.json) 唯一生成。

隐藏的尺寸参考夹具仍直接导入生产组件，ResizeObserver 测量十五项样本的高度和图标宽度，变体集合复用既有 Button 参数数据。`density.browser.tsx` 的尺寸测量、200% 文字放大、侧栏布局、输入组边界和交互检查完整保留。隐藏入口不删除验收场景，也不将紧凑控件尺寸改成全局命中区规则。

跨端侧栏表仍表达逻辑基准，不是每个常量在每个平台上的最终尺寸。Web 默认侧栏行保留 32px，移动最小 48px；实际行盒放大时通过 `1lh + .75rem` 增长。CSS px 基准不改为 rem，原生 pt、ScaledMetric / Dynamic Type 和 bridge 均不变。桌面图标 16px、移动展开控件视觉框 40px / 命中框 44px 继续独立；Web 通用控件沿用组件密度，不宣称每个紧凑按钮都满足移动 44px 目标。

### Web 间距使用目录

Spacing Docs 分为「Web 间距标尺」与「跨端间距基准」，保留旧 `#foundation-spacing` 锚点，前者新增 `#foundation-spacing-web`。六项 DTCG 基准及原 CSS/Swift 产物、消费映射与完整覆盖清单不变；All tokens 继续收录六项项目基准，上游使用标尺只在 Spacing 分类展示。

[间距目录生成器](../scripts/build-project-spacing-catalog.mjs) 复用生产依赖图，扫描可达 TS/TSX 的静态字符串、模板静态片段和可达本地 CSS 的 `@apply`。使用锁定的 Tailwind 编译器验证候选，收集 padding / margin / gap / space 及 scroll-padding / scroll-margin；排除故事、测试、不可达模块、注释、类型、导入路径及 width / height / translate 等尺寸或定位类。此目录是可达模块的静态候选集合，不模拟所有局部死代码裁剪、条件分支或某一时刻的实际渲染；动态拼接的完整类名仍应按 Tailwind 原有规则显式列出。

[生成清单](spacing-usage.generated.json) 记录全部间距工具类及消费者。当前使用 16 个标尺档位、128 条工具类：`0 / 0.5 / 1 / 1.5 / 2 / 2.5 / 3 / 3.5 / 4 / 5 / 6 / 8 / 10 / 12 / 14 / 16`。基准直接读取已安装 `tailwindcss/theme.css` 的 `--spacing`（当前 `0.25rem`），表达式直接取上游编译的 `gap-{step}`，不复制固定 px 标尺；若生产新增 `px`，会按上游 `1px` 自动出现。负边距按正向幅度归档，原带负号的工具类留在消费者目录。

`auto`、`p-[3px]`、InputGroup 的 `-0.3rem / -0.15rem` 及 `env(safe-area-inset-*)` 也记录在清单中，但不提升为全局标尺。局部 CSS 声明、内联尺寸和原生间距由既有所有权契约及完整 token 覆盖清单维护，本目录不宣称覆盖每一处布局常量。Spacing 两个分区均使用 Token / Value 两列表格，Value 列将灰色横条与数值并排展示；所有横条左端对齐，宽度对应当前实际间距。Web 横条使用上游表达式计算 rem 结果并监听尺寸变化，零档保留 0px 宽度、另用 1px 伪元素标记原点；跨端横条仍按原始固定 px 基准显示，不改变 pt 的平台映射。

`pnpm spacing:build` 更新目录，`pnpm spacing:check` 检查漂移，`pnpm test:spacing` 验证扫描和生成。Storybook 启动及构建自动生成，生产类名变化后可重新生成刷新；内容不变时保持 mtime，检查漂移不覆盖文件。`verify:design` 包含检查及测试。目录仅供文档消费，生产构建、token 定义和组件规则不依赖它。

### Typography 使用目录与展示范围

完整的分层、内容角色、运行时派生和兼容规则见 [Typography 系统](typography.md)。七档 rem 字号、三档字重、三种行高策略与八个通用文字角色由 scale.ts 统一生成并由生产 CSS 消费；原 17 个组件变量保留兼容别名，退出默认展示和生产引用。

Typography Docs 保留 `#foundation-typography` 与全部旧故事 ID，只显示 Docs。字体角色的定义与样本合并到同一张两列表格，另有字体、基础字号、字重、行高四个分区；旧原生分区和标题 ID 作为通用文字样式标题的兼容定位点保留；All tokens 列出全部已注册基础与语义定义，兼容 adapter 不重复展示。默认字体、默认正文字号、Provider 的宽度映射与原生规则保留；零散字号和标题按用户确认归入统一标尺，全部字号随根字号缩放。等宽字体新选项只来自现有 Mono 分组，读取时兼容旧的比例代码字体；随机搭配不再生成比例代码字体。行宽选项显示“窄 / 适中 / 宽 / 宽松”，旧 60 / 70 / 80 / 90 仅为存储档位标识，不是 CSS ch；16px 默认字号时仍对应 448 / 528 / 592 / 720px，其他字号沿用原等比例计算。

[排版目录生成器](../scripts/build-project-typography-catalog.mjs) 复用生产依赖图，读取可达 TS/TSX、局部 CSS 及 `@apply`，用锁定的 Tailwind 编译器展开真实工具类、变体、字号附带行高及 slash 修饰。局部 CSS 的 font-family / font-size / font-weight / line-height 和 font 简写、静态 React / CSS-in-JS 属性一并登记；从这些属性的 var() 引用递归追踪局部自定义属性绑定，保留变量名、声明位置与选择器作用域并防止循环，覆盖卡片、摘要字号及搜索预览等局部映射，不将不同上下文错误合并成最终级联结果。保存来源、选择器/媒体上下文、原始声明与工具类；相同属性/表达式去重，`.875em` 与 `0.875em` 合并显示并保留原声明。beautiful-mermaid 的 `font` 参数按其字体栈选项登记，目前读取 `system-ui`。动态字体选择引用也登记，字体选项由原始 FONT_VALUES / FONT_FAMILIES / FONT_GROUPS 直接导入，不执行源码字符串。

[生成目录](typography-usage.generated.json) 记录全部可达生产声明及变量绑定。28 个可选字体按原分组展示；样本进入视口附近（160px）才调用生产加载器，并等待对应 FontFaceSet.load，分别显示加载与失败回退状态。本机字体与 CJK 回退依平台解析；真实斜体 face 保持按需请求，允许无真实斜体的 style 合成回退，仍禁止 weight 合成。

字号只展示一张七档 rem 标尺表，Token / Value / Example 三列，数值同时保留原 rem 和浏览器实际 px。字重与行高策略各三行。通用角色表展示八种 size / weight / leading 组合的计算指标。生成的每个字号行高是工具类适配结果，不作为额外可选策略。用户阅读字号、行高和宽度的旧选项继续兼容；四项原生 pt 基准及 21 项原生表达式单列。完整定义与兼容名称仍在覆盖清单，不将工程扫描结果重复铺进默认 Docs。

原生目录读取 apps/apple/Sources 中 SwiftUI 的 font / fontWeight / lineSpacing 调用，当前 21 项去重表达式，忽略注释、字符串及现有纯 #if DEBUG 分支，保留生产 #else；记录行号用于维护。不求值 SDK、平台分支或运行时条件，不把系统文字角色强行换算成 Web 字号。字号与字重来自原表达式，Dynamic Type 保持原平台职责，lineSpacing 是附加 pt 行距而非 CSS 行高倍数。Web 目录不扫描不可达的 LiveMarkdownEditor、测试/故事、库内部生成的 SVG/CSS 或模拟运行时 DOM，原生目录也不替代 Swift 编译和真机验收。

`pnpm typography:build` 从 scale.ts 生成生产标尺 CSS 并更新使用目录，`pnpm typography:check` 检查漂移，`pnpm test:typography` 验证收集和生成。Storybook 启动、构建与 verify:design 已接入；内容不变时保留 mtime，检查漂移不覆盖文件。使用目录仅供文档；生产标尺由 scale.ts 生成，registry 和完整覆盖清单登记全部定义、适配层与消费者。

## 原生安全区与主题同步

[WebView.swift](../apps/apple/Sources/WebView.swift) 从 `scrollInsets` 写入 `--ios-top` / `--ios-bottom`，单位为 px；[app-sidebar.css](../apps/ui/src/components/app-sidebar.css) 消费时以 `0px` 回退。安全区随容器和系统状态变化，不设置静态的全局尺寸基准，也不借文档整理改变最低系统要求。

原生自定义颜色继续使用浏览器计算结果，经 [readIOSPalette](../apps/ui/src/lib/ios-palette.ts) 和既有 RGBA bridge 输出。Swift 不维护一套平行的 Web 主题。输出键、消费者及测试边界见 [Token 消费映射](token-consumption.md)。

## 上游浮层定位变量

Base UI Positioner 在浮层局部计算以下变量。定义来自锁定依赖，不复制为产品全局默认值。

| 变量 | 含义 |
| --- | --- |
| `--available-height` | 当前浮层的可用高度 |
| `--available-width` | 当前浮层的可用宽度 |
| `--anchor-width` | 锚点宽度 |
| `--transform-origin` | 相对定位结果的变换原点 |

可用宽高在初始阶段可能使用视口单位，完成测量后使用计算尺寸；不要假定整个生命周期都为固定 px。类型与依赖声明路径见覆盖清单的“上游运行时变量”；实际消费者包括 Select、Popover、Dropdown Menu、Tooltip 和编辑器浮层。

## 组件与平台的维护归属

以下内容继续由组件、上游库或系统拥有，登记完整不等于提升为全局 token：

- 颜色与字体：原生 palette、内容局部颜色、界面文字标尺和笔记排版偏好。
- 间距、尺寸与形状：Tailwind 间距标尺、控件密度、内容布局、边框与焦点几何。
- 动效与层级：时长、缓动、手势恢复、减少动态效果、portal 与 stacking context。
- 响应式与平台：导航断点、内容容器、安全区、系统字体缩放、材质及浮层定位。

全部 17 项契约的标识、说明、维护源码和消费者见覆盖清单的“组件 平台 与上游所有权”。Storybook 不再展示 `Contract / Guidance` 表格；原来仅承载这些工程信息的 Layering、Responsive 页面撤下。Motion 分类展示实际动效规范与嵌入演示，完整回归保留隐藏 ID。

## 颜色诊断方法与维护

Color 导航仅保留 Docs。Diagnostics 隐藏导航，保留原 ID `foundations-colors--default`、直达路由及全部测试；它只展示当前主题摘要和 22 组配对结果。前景/背景映射、实际用途、源码位置与两项特殊范围维护在 [配对定义](../apps/ui/stories/foundation-colors.example.tsx)，平台消费者见 [Token 消费映射](token-consumption.md)；完整色样仍在 Color Docs 查阅。

[测量函数](../apps/ui/stories/foundation-color-contrast.ts) 将当前 CSS 颜色通过浏览器 Canvas 解析为 sRGB。先将透明背景叠加到样本明确绘制的实色底层，再叠加前景；样本要求 `opacity: 1` 且无背景图。这是平面颜色测量，不是字形抗锯齿或整页截图测量。

- 20 组文字配对沿用 [普通文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) 的 4.5:1 判定；已固定图标沿用 [非文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) 的 3:1 判定。
- `muted-foreground / muted` 作为 Tabs 容器的配对诊断单独标记。实际 Tab 文字由 Trigger 覆写，不能从容器配对推断文字 AA；固定图标也不参与普通文字 AA 统计。
- 页面显示两位小数，判定使用未舍入比值。蓝色 primary 在浅、深两种模式下均约为 3.76:1，属于既有文字未达标项；浅色 muted 容器配对约为 4.46:1，单独作为诊断。原有比值断言保留，既不修改生产颜色，也不降低门槛。样本和交互测试通过不代表全部组件或页面符合 AA。
- [颜色场景测试](../apps/ui/stories/foundation-colors.stories.tsx) 继续检查全部 35 个生产颜色映射的非空变量与实际解析色，将重复色板改为用后即清理的隐藏测试夹具。22 组配对（含九组标签色）、原生 palette 各键、已知问题清单与测量算法基准继续保留。真实 Button / Input / Tabs 的控件与交互断言迁到隐藏的 State Regression 场景，沿用默认、Dark、Blue Slate、Dark Teal、Mobile 五种组合，不在 Diagnostics 展示。
- 禁用控件不计入普通文字 AA 结论；键盘焦点场景检查可达性与样式存在，不将其解释为全部焦点几何或颜色对比度已验收。

## 使用与修改

组件优先通过变体表达意图，普通内容使用语义工具类：

```tsx
<Button variant="secondary">保存笔记</Button>

<div className="bg-background text-foreground">
  <p className="text-muted-foreground">辅助说明</p>
</div>
```

先修改权威源和登记，再运行 `pnpm tokens:build`。`pnpm tokens:check` 检查完整定义、消费及生成物漂移，`pnpm test:tokens` 检查错误登记等反例。定义与覆盖清单禁止为了缩短展示而裁剪。

`active`、`alias`、`baseline-only`、`reserved` 等状态含义沿用 [定义规范](token-system.md)。Storybook 表格不再提供名称展开；状态、别名表达式、原始声明与来源统一在完整覆盖清单中查阅；未使用定义继续登记，不将目录展示视为生产接入。实际组件状态、对比度和原生设备行为仍需对应验收，详见 [验证记录](validation.md)。
