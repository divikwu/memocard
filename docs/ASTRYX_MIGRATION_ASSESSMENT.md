# MemoCard 迁移 Astryx 的风险评估与组件库对比

评估日期：2026-10-21。

当前决定：保留 shadcn/ui + Base UI + Tailwind，取消 Astryx 全量迁移。用户优先考虑在现有组件源码上持续优化结构、交互与细节；后续工作围绕现有体系整理 token 和完善组件维护。下文对比与风险分析保留为选型参考。

此前为 Astryx 方案提出的 iOS 26 / macOS 26 验收基线不再作为当前项目的实施要求。生产组件、主题和最低系统配置未因本次评估替换。

## 已取消迁移方案的范围

Web、H5、本机 Web、macOS WebView 和 iOS 内嵌 Web 采用同一套 Astryx 组件与主题。通用颜色、排版角色、间距、圆角、阴影、焦点和状态语义以 Astryx 为上游；MemoCard 的业务扩展在项目主题中明确维护。

SwiftUI/UIKit 的系统导航、键盘、安全区、文件选择和系统菜单继续使用平台 API。Astryx 提供 React Web 组件，不提供可以直接替换这些控件的 SwiftUI/UIKit 组件。自定义原生界面共享必要的已解析颜色、品牌资源和产品尺寸。

Tiptap、CodeMirror、Markdown 文件契约、笔记属性、搜索数据、保存、撤销和草稿保护继续由现有业务实现拥有。替换编辑器工具栏和菜单属于迁移范围；更换编辑器引擎或笔记格式属于另外的产品改动。

Tailwind 可以保留为布局工具，使用 Astryx 的 token bridge。迁移完成后，活动产品代码和生产依赖不再维护另一套 shadcn / Base UI 基础组件。历史来源快照与许可继续保留。

## 当前项目的实际迁移面

从 `apps/ui/src/main.tsx` 出发，使用项目现有 `productionGraph()` 追踪静态和动态运行时依赖，得到 150 个本地 TS/TSX 模块。`components/ui` 下有 22 个可达 TSX 模块，包含基础组件、侧栏和手势辅助模块；这个数字不是 22 种互不重叠的基础组件。

另外有 10 个可达业务模块直接依赖 Base UI，替换 `components/ui` 目录不能覆盖这些使用点：

- `RichMarkdownEditor.tsx`、`RichHeadingFoldButton.tsx`、`RichFormatTools.tsx`。
- `CalloutColorsMenu.tsx`、`RichImageTools.tsx`。
- `NoteProperties.tsx`、`ChoicePropertyEditor.tsx`、`PropertyOptionList.tsx`。
- `PropertyOptionMenu.tsx`、`TagPropertyEditor.tsx`。

项目已使用 React 19，满足 Astryx 当前 React 19+ 的要求。当前 Vite 构建目标为 Safari 16.4，原生部署目标为 iOS 17 / macOS 14；提高系统要求需要同时更新构建、工程生成器、Xcode 工程、测试矩阵和产品说明。[接入要求](https://astryx.atmeta.com/docs/getting-started)

来源：[项目依赖](../apps/ui/package.json)、[生产依赖图](../scripts/check-design-inventory.mjs)、[Vite 配置](../apps/ui/vite.config.ts)、[Apple 工程生成器](../scripts/generate-project.py)。

## Astryx 与 shadcn/ui 的核心差异

这里将用户所说的 shanui 理解为 shadcn/ui。MemoCard 当前比较对象是 shadcn 风格的本地组件源码、Base UI 交互原语和 Tailwind CSS 的组合。

| 维度 | Astryx | shadcn/ui | 对 MemoCard 的影响 |
| --- | --- | --- | --- |
| 交付与维护 | 主要通过版本化包交付组件、主题和工具 | 主要分发可修改的组件源码，项目拥有本地实现 | Astryx 更便于统一跟随上游；shadcn 更便于直接修改内部行为 |
| 设计规范 | 统一的 token、主题、组件变体和状态契约，包含领域 token 层 | CSS 语义变量与 Tailwind 体系，项目可以自由扩展 | Astryx 的基础规则更集中；采用 shadcn 同样可以建立严格规范，只是项目承担更多治理工作 |
| 主题深度 | 支持主题包、继承、组件级主题规则和局部主题 | 可通过 CSS 变量、类名和组件源码完成主题定制 | Astryx 更适合整体切换品牌风格；shadcn 对局部特殊设计更直接 |
| 组件 API | 通常通过明确的 label、value、options、状态和行为 props 表达意图，也提供部分组合 API | 当前项目大量使用 Root、Trigger、Content 等组合 API | API 不能机械替换，尤其是 Select、菜单、表单和弹层 |
| 样式工具 | 内部使用 StyleX，消费者可使用预编译 CSS、普通 CSS 或 Tailwind | 主要围绕 Tailwind 和可修改的组件类名 | 不需要为了 Astryx 强制重写成 StyleX；CSS 层叠顺序仍需重新建立 |
| 弹层实现 | 使用浏览器顶层、Popover API、CSS anchor positioning 等现代能力 | 由所选交互原语和项目包装负责；本项目使用 Base UI 的 Positioner/Popup 等 API | Astryx 可以减少部分手工层级协调，但改变了现有定位和焦点路径 |
| 移动适配 | 提供 BottomSheet、移动导航和部分自适应呈现模式 | 可以组合 Sheet、Drawer 和响应式布局，具体行为取决于实现 | Astryx 提供更多统一约定，但 MemoCard 的手势、键盘和编辑场景仍需应用层验证 |
| 无障碍 | 提供组件语义、焦点与键盘机制，并在源码中维护相应契约和测试 | Base UI 等底层负责交互无障碍，项目负责标签、组合和视觉状态 | 两者都不能保证接入后的应用自动合规；迁移要重新验收实际任务 |
| 自由度 | 稳定组件接口、主题目标和扩展点约束实现方式 | 可以直接编辑组件源码和结构 | Astryx 有利于一致性；shadcn 对非常规编辑器交互更灵活 |
| 升级 | 统一升级包并运行兼容性和视觉回归 | 已复制的组件不会自动获得所有上游修复，需要对照合并；底层依赖可独立升级 | Astryx 集中了升级工作，也扩大了一次升级可能影响的界面范围 |
| 生态与复用 | 提供自己的组件、主题、模板、CLI 与 agent 文档 | 提供 Registry、Blocks、MCP 等代码分发和集成机制 | 两者均支持 AI 工作流；接入 Astryx 后要让 agent 读取对应发布版文档 |
| 版本与依赖风险 | 当前公开站点标注 Beta，本次 npm 核对 core/theme-neutral 为 0.7.1 | 本地源码的改动节奏由项目控制，但仍依赖底层库和工具链 | Astryx 初期需要固定版本、集中升级和保留回退点 |
| 原生平台 | React Web 组件，不能直接替换 SwiftUI/UIKit 控件 | 当前 React 组件同样不能直接替换原生控件 | 跨端统一依赖语义映射与 bridge，不能靠替换组件包自动完成 |
| 性能与包体积 | 预编译样式、按组件入口导入可以控制成本；整体结果依赖使用范围 | 可以只保留所需源码和工具类；成本同样依赖底层库和业务使用范围 | 缺少同功能构建结果时，不判断哪一个更快或更小 |

shadcn 的源码所有权、组合方式与代码分发能力见 [官方介绍](https://ui.shadcn.com/docs)。其语义颜色与主题能力见 [Theming](https://ui.shadcn.com/docs/theming)，Registry 能力见 [Registry](https://ui.shadcn.com/docs/registry)。Astryx 的预编译接入、样式工具兼容与按组件入口导入见 [Getting Started](https://astryx.atmeta.com/docs/getting-started)，主题继承见 [Theme System](https://astryx.atmeta.com/docs/theme)。Base UI 的键盘和焦点职责见 [Accessibility](https://base-ui.com/react/overview/accessibility)。

### Astryx 对这个项目的主要收益

MemoCard 已有设计规范、Storybook、跨端 token 生成和原生桥接。采用 Astryx 可以让这些规范围绕一个明确的组件与主题上游收敛，减少逐个维护基础控件样式与状态的工作。跨页面视觉一致性、主题变化的可追踪性，以及后续组件升级是主要收益。

这种收益依赖于直接采用 Astryx 组件和主题契约。如果保留全部旧 DOM、旧样式和旧交互，只将颜色变量改名，基础组件维护负担仍然存在。项目可以保留少量有明确业务用途的适配层，但不应重建一套模仿 Base UI 的通用兼容层。

### shadcn/ui 仍然有价值的地方

MemoCard 的编辑器包含虚拟选区锚点、拖动、子菜单、异步属性保存和中文输入保护。源码可修改的组件更容易适配这些特殊行为；上游包缺少扩展点时，Astryx 接入可能需要调整业务组件结构，或给上游提交修复。

当前 token 没有全部纳入同一 JSON，是项目既定的维护边界，不能由此认定 shadcn 缺少 token 或主题能力。迁移 Astryx 是采用更集中上游的工程决策，不是修复一个只有更换库才能解决的问题。

## 风险与处理要求

| 风险 | 等级 | 具体影响 | 处理与验收 |
| --- | --- | --- | --- |
| 最低系统要求提高 | 高，已接受方向 | 旧设备或旧系统用户无法运行新版 | 更新原生部署与 Web 构建目标，说明升级边界；用实际 WKWebView 验证功能，不只检查系统版本号 |
| 编辑器选区与焦点 | 高 | 打开菜单后选区丢失、格式应用位置错误、Escape 返回错误位置、中文组词意外提交 | 保留 selection bookmark、IME 保护与撤销事务；覆盖桌面、触摸、键盘和真实 WebView |
| 菜单和属性选择器 API | 高 | value、onChange、自动关闭、异步失败和多选语义发生变化 | 明确逐项 API 映射；验证保存失败不丢输入、不提前关闭、不重复写入 |
| CSS token 同名异义 | 高 | 颜色含义被错配，正文、按钮、选中和悬停颜色异常 | 按语义建立映射；旧源与新源不能长期同时维护相同角色的独立数值 |
| 全局样式覆盖 | 高 | 重置样式、预置层、未分层 CSS、编辑器样式覆盖组件默认值 | 将 layer 顺序作为唯一入口；验证控件 padding、图标、弹层和正文样式 |
| 外观设置迁移 | 中高 | 既有强调色、中性色、字体和圆角选项被重置或失效 | 保留设备级偏好并提供确定映射；主题家族与强调色分别建模，避免将旧设置静默映射为无关主题 |
| 原生颜色桥接 | 中高 | Web 与原生自定义界面出现颜色不同步、透明色或深色异常 | 验证实际计算色、主题 scope 和 bridge 读取时机；更新浅深色 fixture 与切换回归 |
| 移动抽屉与手势 | 中高 | 下拉关闭与内容滚动冲突、键盘遮挡、草稿关闭时丢失 | 用 BottomSheet 等组件承接通用行为，保留业务关闭条件，覆盖 safe area 和键盘 |
| 包体积与启动 | 中 | CSS 与公共依赖进入首屏，抵消移除 Base UI 的收益 | 使用按组件入口导入和预编译主题；用最终生产构建比较首屏与路由预算 |
| 公共 API 与文档漂移 | 中 | 文档或本地参考源码的接口尚未发布 | 固定 core、theme 和工具的兼容版本；以安装包声明为实现依据 |
| 中文和无障碍回归 | 中 | 内置按钮或读屏文本回到英文，标签与焦点顺序改变 | 显式配置中文 catalog；验证关闭、清除、搜索、错误、键盘导航和 VoiceOver |
| 测试与门禁过时 | 中 | 原有测试只验证 Base UI 的 data 属性；迁移后门禁继续要求旧库 | 将门禁改为 Astryx 所有权；行为测试保留，DOM 断言只在公共行为确实变化时更新 |

### WebKit 支持需要精确到能力

Astryx 的浏览器文档将 Safari 26+ 列为完整表现层级，较旧支持层级不保证 anchor 浮层定位。用户已选择提高最低系统要求，因此新系统可作为迁移基线。[Astryx 浏览器支持](https://astryx.atmeta.com/docs/browser-support)

浏览器支持表的 Safari 17+ 不能理解为 iOS 17.0 拥有所有主题能力。WebKit 在 Safari 17.5 才加入 `light-dark()`，在 Safari 26.0 加入 CSS anchor positioning。具体使用的定位语法仍需要在目标 WebKit 中验证。[Safari 17.5](https://webkit.org/blog/15383/webkit-features-in-safari-17-5/)、[Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

macOS 的独立 Safari 版本与嵌入式 WKWebView 验收不是同一个结果。必须在目标 macOS/iOS 的 App 内测试菜单、子菜单、对话框、底部抽屉、滚动边缘与键盘遮挡。

### token 应按角色映射

现有 CSS 将 Tailwind 的 `primary` 映射到强调操作色。Astryx 的 Tailwind bridge 将 `primary` 映射到正文主色，将强调背景与强调色上的内容单独表达。直接替换 `@theme` 或保留同名工具类，可能在没有 TypeScript 错误的情况下改变产品含义。

映射至少应区分页面背景、卡片、浮层、正文、辅助文字、强调背景及其文字、悬停、按下、选中、焦点、禁用、危险操作和标签颜色。圆角也应区分用户选择的基准与具体组件角色，不能只因为名字相同就当作数值等价。

现行来源：[styles.css](../apps/ui/src/styles.css)、[token 消费映射](../design/token-consumption.md)。Astryx 参考实现为发布包的 `tailwind-theme.css` 与 `theme/tokens`。

### 性能结论需要最终构建

本次检查 npm 0.7.1 分发文件：core `astryx.css` 为 193,767 bytes，Neutral `theme.css` 为 27,296 bytes；分别 gzip 后为 31,161 和 3,948 bytes。合计约 216 KiB 源 CSS、34.3 KiB gzip。

这些数字是两个分发文件的独立测量，不是迁移后的项目增量：Vite 会处理样式，旧样式与依赖会移除，JS 公共依赖和页面分包也会变化，组合 gzip 与逐文件 gzip 的结果不同。不能将它们与项目打包后的产物直接比较，也不能据此断言 Astryx 更大或更小。

项目当前门禁规定初始 JS+CSS gzip 不超过 188 KiB，并为首页、列表、编辑器设置路由预算。迁移必须给出相同业务功能下的前后构建结果；如果需要调整预算，应说明实际差额和收益，而不是为了通过检查直接放宽限制。[包体积门禁](../scripts/check-ui-bundle.mjs)

### 版本基线

2026-10-21 通过 npm registry 核对，`@astryxdesign/core` 与 `@astryxdesign/theme-neutral` 的 latest 均为 0.7.1；core 的 peer 包含 React/React DOM >=19 和 StyleX ^0.19.0。本地 Astryx 参考目录的 package 标记为 0.7.2，不能将该快照的新增接口直接当作 0.7.1 公共契约。

初期锁定兼容的发布版本，以发布包的 `.d.ts`、实际行为和对应版本文档为准。后续按升级单集中检查 API、主题输出、包体积和回归。站点标注 Beta 代表公共版本仍在演进，不代表其全部组件不可用，也不代表内部使用经历能替代 MemoCard 验收。[Astryx](https://astryx.atmeta.com/)、[npm core](https://www.npmjs.com/package/@astryxdesign/core)、[npm Neutral](https://www.npmjs.com/package/@astryxdesign/theme-neutral)

## 组件迁移映射

| 当前实现 | Astryx 目标 | 必须保留的 MemoCard 行为 |
| --- | --- | --- |
| Button、图标按钮 | Button、IconButton | 中文可访问名称、禁用、异步保存状态、表单提交语义 |
| Input、Textarea、输入组合 | TextInput、TextArea、InputGroup 或相应表单组件 | 输入焦点与 ref、IME、只读、校验、粘贴、受控值 |
| Select | Selector | 当前值、分组、字体预览、键盘选择、标签与说明 |
| 标签与属性候选列表 | 评估 MultiSelector、Typeahead 等公共 API | 新建、重命名、删除、异步错误、正文标签关联、选项色彩 |
| Switch、Checkbox | Switch、CheckboxInput | 持久化状态、禁用、读屏名称、键盘切换 |
| Tabs | TabList、Tab 与应用 panel | 受控激活项、面板关联、键盘切换、卸载策略 |
| Dialog、危险确认 | Dialog、AlertDialog | 打开/关闭条件、初始焦点、返回焦点、保存期间防误关 |
| DropdownMenu、编辑器子菜单 | DropdownMenu、DropdownMenuSubMenu 等 | 受控状态、异步选择、子菜单、保持编辑器选区、关闭恢复焦点 |
| Popover、Tooltip | Popover、Tooltip | 虚拟或外部锚点的可行性、非抢焦点行为、溢出避让 |
| Sheet、手势关闭 | BottomSheet、SidePanel 或移动导航 | 滚动与拖动协调、键盘、安全区、草稿保护 |
| Sidebar 与顶栏 | SideNav、AppShell 等适配业务结构 | 切库、标签树、独立展开、搜索、选中与折叠状态 |
| Card、Badge、Skeleton、分隔、提示 | 对应 Astryx 展示组件 | 加载/空态/错误语义与业务布局 |

表内是迁移目标，复杂选择器、虚拟选区锚点和侧栏业务契约需要先做接口适配验证。组件名称相似不代表功能完全等价。缺少必要公共扩展点时，应修复明确需求或提交上游支持，避免自行复制库内部实现。

## 已取消迁移方案的实施顺序与完成标准

目标是全量替换。实现分阶段提交，每一阶段保持应用可以运行，最终统一切换。

1. 建立当前行为与构建基线，固定发布版本，更新系统与构建目标；验证旧版仍可作为回退点。
2. 接入主题、CSS layer、中文 catalog、按语义映射的 token 和本地字体；验证基础控件、浅深色、设置兼容和原生颜色采样。
3. 替换应用外壳、基础表单与设置；验证导航、响应式、可访问名称和持久化。
4. 替换搜索、快速记录、属性编辑和危险确认；验证异步成功/失败、关闭条件、焦点恢复和草稿保护。
5. 替换编辑器工具栏、菜单、子菜单和选择浮层；验证 IME、选区、撤销、拖动与图片操作。
6. 移除活动代码里的旧原语、旧基础样式和旧依赖，更新组件维护表、token 生成/消费表、Storybook 与 CI 门禁；验证完整依赖图和生产包。
7. 执行 Web、原生、服务构建与相关业务回归，在目标系统的实际 App 中验收；记录未覆盖平台与状态，不将构建成功当作全部交互通过。

完成标准：活动 UI 组件与通用设计值有明确 Astryx 所有权；业务数据与文件契约稳定；现有偏好有可解释的迁移；旧组件库不再承担生产交互；关键流程、原生 bridge、性能预算和目标 WebKit 验证闭环。尚未覆盖的设备、辅助技术和系统组合应明确列出。

## 评估判断

对 MemoCard，采用 Astryx 的主要理由是统一视觉与维护来源；继续使用 shadcn 的主要理由是源码定制自由。用户已明确持续定制现有组件的优先级，因此当前选择保留 shadcn，不再推进 Astryx 迁移。

后续整理现有 token 时，应保持每类设计值的唯一维护来源、明确语义与真实消费，并保留编辑器、业务保存和原生桥接的回归验证。性能、可访问性和维护成本的改善需要各自证据。
