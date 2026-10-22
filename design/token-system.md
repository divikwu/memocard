# MemoCard token 定义规范

本规范覆盖 MemoCard 的基础标尺、语义角色、组件契约与平台映射。继续使用 shadcn/ui + Base UI + Tailwind；本轮整理保持既有数值、CSS 选择器、主题优先级、用户设置和组件交互。Astryx 不作为 token 来源，也不提高系统要求。

工具类映射、运行时输出、平台集成与维护归属的阅读入口见 [Token 工程维护与集成](token-engineering.md)。Storybook 精简展示不裁剪本规范或完整覆盖清单。

## 定义层级

| 层级 | 定义 | 使用规则 |
| --- | --- | --- |
| 基础标尺 primitive | Tailwind 色阶、间距、字号、字重，以及 JSON 中的可移植尺寸基准 | 普通布局可以直接使用 `p-2`、`gap-4`、`text-sm`；不为每个工具类重复创建变量 |
| 语义 semantic | 背景、正文、强调操作、悬停、焦点、阴影和界面/笔记字体角色 | 可换肤的组件优先使用语义；`bg-primary` 表达强调操作，而不是固定某种色相 |
| 组件 component | 有产品含义的侧栏尺寸、菜单密度、编辑器浮层、手势参数 | 有真实消费者和独立调整需求时提取；一次性布局继续由组件维护 |
| 映射 adapter | `@theme inline` 工具类映射、JSON 平台输出、运行时原生 palette | 只能引用权威定义或平台 API；不增加平行维护的默认值 |

层级是使用职责，不强制每个 token 都经历三次别名。每类值只有一个权威来源；默认值、按主题覆盖和按组件覆盖可在同一契约下并存。

## 必须覆盖的类别

| 类别 | 定义范围 | 当前来源与边界 |
| --- | --- | --- |
| color | 原始色阶、前景/背景配对、操作、状态、标签和标注颜色 | Tailwind 色阶；主题、标签与标注 token CSS；原生消费已解析 palette |
| typography | 字体角色、字号、字重、行高、阅读宽度、段距 | 界面沿用 Tailwind 与主题字体；笔记偏好由 TypographyProvider 管理；原生使用系统 Dynamic Type |
| spacing | 间距标尺、图文间距、缩进与容器留白 | Web 使用 Tailwind；需要跨端共享的基准由现有 DTCG JSON 生成 |
| sizing | 控件密度、行高、图标视觉框、触摸命中目标 | 控件大小变体由组件拥有；侧栏跨端尺寸由 JSON 拥有；视觉框不等于命中框 |
| shape | 圆角选择、派生圆角、边框与分隔线 | JSON 拥有七档圆角选择；主题拥有 `--radius-*` 派生关系；边线宽度沿用组件/Tailwind |
| effects | 阴影、遮罩、透明度与焦点反馈 | 主题 token 拥有浮层、表面、聚焦表面、轻量控件和悬浮控件阴影；遮罩、禁用透明度、焦点几何仍由组件契约拥有 |
| layering | 页面、编辑器工具条、模态和嵌套浮层的层级关系 | 继续由既有定位容器、portal 和组件 z-index 拥有；同一数值不意味着同一 stacking context |
| motion | 时长、缓动、动画属性、手势恢复和减少动态效果 | Tailwind 过渡标尺、组件动画、SheetSwipe 与全局 Reduce Motion 各有来源；不改变既有手势阈值 |
| responsive | 视口断点、容器断点、阅读约束与安全区 | Tailwind 断点、useIsMobile 和各业务容器规则；原生 safe area 由系统提供 |

覆盖清单见 [生成清单](token-coverage.generated.md)，其分类、类型、主题轴、消费入口和所有权登记维护在 [registry.json](tokens/registry.json)。可移植尺寸逐项消费继续由 [token-consumption.md](token-consumption.md) 登记。覆盖清单中的组件所有权不等于其全部值已迁入全局 CSS。

## 每项定义的契约

公开 CSS token 的名称、默认表达式与覆盖次数从 CSS 自动采集；类型、层级、主题轴和状态从 registry 的唯一匹配族继承，消费解释与自动索引分别提供。新增名称必须被明确的族规则覆盖，不能留下未登记的公开变量。修改权威源后重新生成清单。

Theme、Typography 和原生 WebView 的运行时输出逐项登记名称、类型、单位、默认/回退来源与写入来源，覆盖界面字体、笔记字体、字号、摘要字号、行高、段距、阅读宽度与原生安全区。静态字体默认值与偏好覆盖共享同一名称，不作为两个独立值维护。AST 检查验证已登记 Web 模块中的字面量键及 setProperty 字面量参数；Swift 只提取 callAsyncJavaScript 的普通字符串。两者都不解释任意动态代码。

Base UI Positioner 的 `--available-height`、`--available-width`、`--anchor-width`、`--transform-origin` 属于上游运行时契约，清单逐项检查锁定安装包的声明。它们由具体 Positioner 计算并在局部作用域消费，没有产品全局默认值；不得为了补齐定义而在 `:root` 写入固定值。

生成消费索引从 `main.tsx` 追踪生产模块和 CSS 导入，解析字面量引用、局部覆盖、工具类及命名样式类依赖，另扫描 Apple Sources 的尺寸引用。工具类依赖使用锁定的 Tailwind 编译器解析，包含 variant、透明度和 `@theme inline` 替换；命名样式类及有界模板列出可能依赖集合。原生 palette 的无界动态读取必须显式登记，并由测试核对 `IOS_PALETTE_KEYS`。生产 CSS 每份必须有已登记所有者，消费者中的普通 `var()` / 工具类简写引用必须存在于公开、局部、生成或上游契约中。代表消费入口用于解释用途，不能代替自动逐文件索引。

索引覆盖当前生产源码中的静态关系，不执行任意 JavaScript，也不把潜在分支、CSS 继承、portal / Shadow DOM 的关系或 DEBUG 预览认定为全部运行验收。未从生产入口可达的历史实现、测试与故事不计作生产消费者；组件组合关系继续见维护表。新增动态拼接方式时补契约和反例，不能静默跳过。

| 字段 | 要求 |
| --- | --- |
| 标识与用途 | 名称说明角色；保留既有 shadcn 语义名；组件角色带所属范围 |
| 类型与单位 | 明确 color、dimension、fontFamily、shadow、percentage 等；CSS 表达式保持原格式，不能直接当成 DTCG JSON 值 |
| 默认与覆盖 | 默认定义和模式/偏好/局部覆盖都指向源码；有多个覆盖时遵循真实 CSS 顺序，不合并成无条件值 |
| 引用与派生 | 引用必须可解析到登记变量、生成变量或当前 Tailwind 标尺；不得产生别名循环 |
| 平台 | 说明 Web、原生自定义界面或系统 API 的消费边界 |
| 消费与状态 | 区分真实生产消费、别名输入、仅基准展示、保留角色、组件拥有和平台拥有 |
| 维护与验证 | 定义位置、消费者、对应 Story/测试及变更影响；生成物禁止手改 |

状态含义：`active` 为有已登记生产入口；`alias` 为引用或工具类映射；`baseline-only` 为仅展示基准；`reserved` 为保留定义而无生产消费；`component-owned` 为由组件源码维护；`platform-owned` 为系统拥有；`upstream-owned` 为沿用锁定上游。族级 `active` 不表示每个主题组合均通过视觉验收。

## 命名与状态语义

保留 `background / foreground`、`card / card-foreground`、`popover / popover-foreground`、`primary / primary-foreground`、`secondary / secondary-foreground`、`border / input / ring` 和 `sidebar-*`。

`--accent` 是 shadcn 的界面状态表面，`--accent-500` 是强调色阶，二者不是同一个层级。`--accent-text` 当前用于固定图标，应按实际非文本用途验收。`chart-*`、`emphasis*` 和 `sidebar-primary*` 保持保留状态，不为消除未使用条目而改变生产样式。

标注颜色统一在 `import-layout.tokens.css` 维护：`--callout-background-*` 是浅深色背景，`--callout-text-*` 是浅深色正文及标题继承色，`--callout-swatch-*` 是菜单中保持固定色相的样本。三组均包含 gray、brown、orange、yellow、green、blue、purple、pink、red；默认文字和默认菜单色样继续使用 `--foreground`，默认背景继续透明。菜单样本与实际正文原本数值不同，按各自角色保留，统一维护来源不改变现有外观。菜单的选项值、数据属性与保存格式保持不变。

| 状态 | 含义与当前契约 |
| --- | --- |
| 默认 | 正常可操作状态，按组件变体选择语义前景/背景 |
| hover | 指针悬停；使用 `--hover-bg` 或现有叠加规则；不能据此判断选中 |
| pressed | 按下反馈；使用现有组件 active 样式，保持与持久选中语义分离 |
| selected / checked | 当前位置或已选值；由组件 aria 状态和现有选中背景表达 |
| focus-visible | 键盘操作目标；`ring` 是颜色角色，环宽、偏移和出现条件由组件拥有 |
| disabled / read-only | 不可操作与只读分别表达；保留组件透明度、指针和读屏行为 |
| invalid / destructive | 输入错误与危险动作分别表达；继续使用既有校验、提示和确认流程 |

不同状态当前使用相同数值可以保留。以后需要独立调整时，先确定消费者和优先级再提取角色，不能仅为命名完整而增加无消费者变量。

项目阴影保留既有数值：`--overlay-shadow` 用于浮层，`--surface-shadow` 用于快速记录、加载占位与笔记卡片，`--surface-focus-shadow` 用于快速记录聚焦表面，`--control-shadow` 用于移动端轻量按钮，`--floating-control-shadow` 用于底部悬浮搜索与快速记录入口。聚焦表面与悬浮控件阴影随明暗模式覆盖，普通表面与轻量控件维持原有固定值。它们与已安装 Tailwind 标尺不完全相同，不能用相近档位替换。`shadow-lg` 等既有上游消费者继续读取上游；混合选中状态的内嵌下划线仍属于组件状态指示，不归入 Elevation。

## 单位与平台映射

- Web 的 Tailwind 间距/排版通常随根字号缩放；便携 JSON 中 px 是现有逻辑基准。不能将同一数字自动认定为 rem、设备像素或原生点的等价物。
- JSON 的 `radius.sm` 是用户选择的一档基准；CSS 的 `--radius-sm` 是从当前 `--radius` 派生的角色。保持现有派生公式，本轮不增加 clamp 或修改零圆角等边界。
- 自定义原生侧栏通过生成的尺寸常量和现有 `rowRadius` / palette bridge 消费。系统文字、材质、确认框、菜单、键盘和安全区不复制为 Web token。
- `:root` / `.dark` 的颜色由浏览器计算后采样为 RGBA；不在 Swift 中重新实现主题解析。字体偏好继续使用本地资源与已有回退。原生 `WebView.swift` 将 `scrollInsets` 写为 `--ios-top` / `--ios-bottom`（px），Web 的导航容器按既有 `0px` 回退消费，不在 Web 维护另一套安全区数值。
- 视口与容器查询使用不同的参考空间。768px 的导航边界不代表所有 640、700、1024px 的业务布局规则都应统一为它；media query 也不直接读取普通 CSS 自定义变量。

## 权威来源和源码批次

1. **主题批次**：把原 `styles.css` 的 `@theme inline`、浅深色与配色定义原样移至 `features/theme/tokens.css`；保留全部覆盖顺序。
2. **领域颜色批次**：标签定义移至 `tag-colors.tokens.css`，标注背景移至 `import-layout.tokens.css`；调用方样式保留原文件和加载入口。
3. **正文默认字体批次**：静态字体回退移至 `features/typography/tokens.css`；TypographyProvider 的用户偏好解析、运行时写入和存储格式保持。
4. **持续维护**：间距/圆角/侧栏 JSON 保持现有生成契约；动效、层级、密度和响应式条目按已登记的组件/平台来源维护。后续有真实复用需求时，每个提取批次同时更新 source、registry、消费表和回归。

这些批次只调整维护位置。本轮不新增全局运行时 token 服务、不更换组件原语、不修改组件接口，也不统一原本不同的组件度量。

## 新增 修改 与弃用

新增前确认现有标尺或语义能否表达需求；登记用途、类型、单位、主题轴、平台与消费者后再接入。公开 CSS 变量必须放在登记的 token 源中。组件局部变量继续有自己的作用域，不因名字中出现 `--` 就自动成为全局 token。

修改默认值或别名关系是潜在视觉变化：在独立变更中说明影响并提供相关浅深色、状态和平台证据。移动定义必须同时移除旧定义，维持覆盖顺序。弃用时先迁移消费者与原生 bridge，再移除定义和登记，保留必要的偏好兼容解析；不静默修改用户选择。

## 验证和完成标准

`pnpm tokens:build` 生成现有跨端输出与完整覆盖清单；`pnpm tokens:check` 只读检查输出、登记匹配、引用、生产入口到 CSS 的导入可达性、CSS 所有权、Web/原生运行时输出、上游变量和消费索引漂移，并阻止 reserved 角色被生产代码消费而状态未更新。`pnpm test:tokens` 验证缺失登记、重复归属、无效元数据、坏引用、未登记动态读取、未拥有的 CSS 与断开的加载入口等反例，既有尺寸/消费测试继续运行。消费者登记不代替实际组件状态验收。

同次构建还输出 `token-coverage.generated.json`，供 Storybook 直接展示完整 CSS 声明、覆盖、运行时输出、可移植尺寸与所有权。此 JSON 与 Markdown 都是权威源的派生视图，不是新的定义来源。只读检查及时间戳/漂移回归同时覆盖两者；文档布局和浏览器色样转换仍由 Storybook 开发代码负责。

源码批次要求：既有外观偏好组合的计算样式和原生 palette 与改动前一致；代表浅深色截图一致；Foundations 与组件交互回归通过；生产构建及包体积门禁通过。原有色彩对比度问题单独记录，不借此次整理改变外观。真实 App、设备或辅助技术未重新验收时，结果必须说明其覆盖范围。

格式与工具参考：[shadcn 语义主题](https://ui.shadcn.com/docs/theming)、[Tailwind 主题标尺](https://tailwindcss.com/docs/theme)、[DTCG 2025.10 交换格式](https://www.designtokens.org/tr/2025.10/format/)。DTCG 用于现有可移植 dimension 数据；CSS 主题与组件策略采用各自原生表示。
