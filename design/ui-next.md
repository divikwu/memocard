# 新旧 UI 的 Storybook

使用两个独立的本地端口，分别打开查看组件和页面。

| 版本 | 地址 | 命令 |
| --- | --- | --- |
| 现有版 | http://127.0.0.1:6006/ | `pnpm --filter @memocard/ui storybook` |
| 新版 | http://127.0.0.1:6016/ | `pnpm --filter @memocard/ui storybook:ui-next` |

新版源码与故事在 `apps/ui/ui-next/`，使用独立的 `.storybook-next/`、Vite 配置和 CSS 入口。

## 两套 UI 的运行与提交约定

| 用途 | 现有版（默认） | 新版 Web/H5 |
| --- | --- | --- |
| 本地应用 | `pnpm --filter @memocard/ui dev` | `pnpm --filter @memocard/ui dev:web-next` |
| 应用入口 | `apps/ui/index.html` → `src/main.tsx` | `apps/ui/ui-next/web/index.html` → `main.tsx` |
| 构建命令 | `pnpm --filter @memocard/ui build` | `pnpm --filter @memocard/ui build:web-next` |
| 构建输出 | `apps/ui/dist/` | `apps/ui/dist-web-next/` |
| 单元测试 | `pnpm --filter @memocard/ui test` | `pnpm --filter @memocard/ui test:ui-next` |
| Storybook 输出 | `apps/ui/storybook-static/` | `apps/ui/storybook-next-static/` |

默认入口、根 `pnpm build` 与 Apple/服务打包仍使用现有版；新版通过独立入口访问。两套视图共享业务控制器，分别保留主题和样式边界。此次提交保留两套实现，不切换已安装客户端。

`pnpm verify:web` 验证默认应用，`pnpm verify:design` 验证现有 Storybook，`pnpm verify:ui-next` 独立验证新版类型、Lint、单元测试、Web/H5 和 Storybook 构建。GitHub required CI 的 `design` 作业同时运行后两项；新版测试使用独立 Vite 配置与内存数据桥，不由默认测试配置收集。

## 新版规范与组件

[打开新版 all tokens](http://127.0.0.1:6016/?path=/docs/ui-next-theme--docs)。Foundations 按 `all tokens / palette / colors / elevation / icons / illustrations / motion / shape / spacing / typography / typeset` 组织，共十一个 Docs 页面。Palette 位于 Colors 之前；Illustrations 位于 Icons 之后，仅维护使用规范。原 `ui-next-theme--foundation` 链接保留为隐藏故事，其他已有故事 ID 保持不变。组件区提供 [Luma 卡片展示](http://127.0.0.1:6016/?path=/docs/ui-next-luma--docs) 与 35 类基础组件的独立 Docs 和 Canvas。原有十二类的 ID 保留；新增 Accordion、Badge、Breadcrumb、Calendar、Chart、Checkbox、Combobox、Empty、Field、Input Group、Item、Label、Native Select、Progress、Radio Group、Separator、Sidebar、Skeleton、Slider、Spinner、Table、Toggle、Toggle Group。所有组件文档沿用 Overview / Properties / Accessibility 模板。

规范页共用 `TokenPage`，Palette 使用独立的 `PalettePage`，共用文档的标题、简介与右侧目录样式。浅深色在 Storybook 工具栏切换，分类间共享模式。`token-catalog.ts` 直接读取 `theme.css` 中的语义定义、深色覆盖、Tailwind 映射和自定义 utility。`all tokens` 按颜色、色系、语法、数据、边框、焦点、圆角、阴影与排版等用途分组，每个语义或尺度定义只出现一次；基础色板、语义与尺度定义、派生标尺、合成文字样式分别计数。Colors 页集中展示语义角色；原 Palette Tokens 标题改为 Hue Roles，保留原锚点与角色名称。

Palette 从当前安装的 `tailwindcss/theme.css` 自动读取全部基础色板，不维护手写色值副本。Tailwind 4.3.3 提供 26 个色系、每系 11 阶（50–950），加黑白共 288 项；按色系分组，每个色阶竖向排列为一行，以 Token / Value / Preview 表格展示变量名、原始 OKLCH、可复制的 sRGB HEX 和右侧预览。窄屏在表格内部横向滚动。色阶本身不随明暗模式改变。构建保留基础变量，避免动态展示时被未使用变量裁剪。语义配色引用这些变量，并按明暗模式选择色阶；组件继续使用语义工具类。

表格按 `Token / Value · 当前模式` 展示实际 CSS 解析值和当前模式的引用表达式。颜色通过浏览器 Canvas 转为 sRGB 十六进制，涵盖 OKLCH、透明度和混色；rem 尺寸换算为当前 px。没有深色覆盖的项目继承基础值。`brand` 显示“待配置”，不生成色样。阴影与圆角保留预览。Typography 分别展示字体、12 个原始字号、字重及 14 个语义文字样式；语义样式的字号、字重与行高读取实际样字的计算样式。

Spacing 保留一个 `.25rem` 源基准，并展示 0、0.5、1、1.5、2 至 12 的完整 15 档派生标尺，列出 rem、当前 px 与工具类。派生步阶不额外计入源 token 数量，三个控件高度单独维护，按 Luma 适配为 sm 32px、md 36px、lg 40px；标准控件通过 `h-element-sm/md/lg` 消费对应角色，正方形图标控件使用 `size-element-sm/md/lg`，不再用布局间距近似控件高度。

Icons 页聚焦 Hugeicons 图形用途与用法，颜色通过链接查阅 Colors，尺寸和无障碍要求合并到用法说明。Shape 页聚焦圆角标尺、同心圆角与 Best Practices；边框与焦点定义保留在 All tokens。Illustrations 维护使用场景、Guidelines 与 Placement，不导入品牌插画或新增产品组件。Motion 分开展示 Duration 与 Easing，说明适用场景和用户偏好，清单在减少动态效果时显示当前有效的 0ms。

Color、Elevation、Motion、Shape、Spacing、Typography 六页在规范内容之后、来源之前展示 Best Practices，并提供页内目录锚点。规则采用 Guidance / Practices 两列表，以 Do / Don't 明确表示建议与避免，引用当前 Tailwind 接口。All tokens 保持索引；Icons 使用用途与无障碍说明；Illustrations 使用 Guidelines，避免重复规则表。

## Luma 卡片展示

Luma 页面按 shadcn 官方 `preview-02` 组合 33 个卡片示例：贡献图、阈值设置、储蓄目标、交易表格、通知、日历及设备控制等。布局保留七条网格轨道，中部跨两列；桌面画布宽 3000px、间距和内边距 40px，窄屏画布宽 2400px、间距和内边距 16px，画布内部可横向滚动。卡片继续使用当前语义 token、字体与 8px 圆角基准。

来源固定到 shadcn/ui 提交 `25af02b1b467fcd53b63e0c6d6d324c57c16ef18`；缺少的基础组件由官方 Base Luma registry 适配，图表使用 Recharts，二维码由 react-qr-code 生成。封面上传框沿用原示例的空占位。卡片是本地组件展示，不连接账户、支付或资金服务；选择器、滑块、折叠面板、日期与选择状态使用真实组件交互。

Sidebar 文档示例关闭全局快捷键与持久化，避免同一页多个示例相互影响；默认持久化 cookie 使用独立的 `ui-next-sidebar-state` 名称。

## 主题来源与维护

`apps/ui/ui-next/theme.css` 维护项目的语义引用、非颜色尺度及 Tailwind 映射。基础色值由安装的 Tailwind 包提供；语义结构以 Astryx 提交 `3133fb04b9a22feeafde8b52fcca583bf89db128` 为模板，当前视觉数值与组件样式接入 shadcn Luma preset `b5F2gjwQRE`，并保留项目覆盖：

- [Neutral 主题](https://github.com/facebook/astryx/blob/3133fb04b9a22feeafde8b52fcca583bf89db128/packages/themes/neutral/src/neutralTheme.ts)提供初始圆角、字体、阴影层次与动效尺度的参考；当前字体和派生圆角按 Luma 调整，颜色使用 Tailwind 色板引用，不再声明与 Astryx Neutral 原值相同。
- [Core token](https://github.com/facebook/astryx/blob/3133fb04b9a22feeafde8b52fcca583bf89db128/packages/core/src/theme/tokens.stylex.ts)提供 39 个通用颜色与 40 个色系角色，以及间距、控件高度、焦点、字号与排版角色。`radius-chat`、4xs/3xs 原始字号及 Display 1–3、Large、H5/H6 的语义名称保留；控件高度及 xs 以上字号数值按 Luma 与其 Tailwind 标准标尺适配，Neutral 的 H3/H4 字重覆盖继续保留。
- 五个 `shadow-inset-*` 角色沿用 Neutral 的状态语义与几何，颜色改为色板派生，与三个 elevation 阴影和统一 outline 焦点分开维护。
- 语法与差异高亮保留 [Syntax tokens](https://github.com/facebook/astryx/blob/3133fb04b9a22feeafde8b52fcca583bf89db128/packages/core/src/theme/syntax/tokens.ts)的角色；当前前景、背景和混色均引用 Tailwind 基础色或语义色。
- [Data tokens](https://github.com/facebook/astryx/blob/3133fb04b9a22feeafde8b52fcca583bf89db128/packages/core/src/theme/domainTokens/dataTokens.ts)提供 56 个数据配色角色；分类色和连续色阶映射到 Tailwind 色板。Luma 的 Sky 默认图表槽位 chart-1–5 对应现有 `--color-data-blue-1` 至 `--color-data-blue-5`，依次引用 sky-300、400、500、600、700，其余数据色角色保留。
- [官方 Tailwind bridge](https://github.com/facebook/astryx/blob/3133fb04b9a22feeafde8b52fcca583bf89db128/packages/core/src/tailwind-theme.css)提供语义工具类的命名与映射方式；MIT 许可保留在 `design/licenses/astryx.txt`。

颜色命名以[官方 Color 页](https://astryx.atmeta.com/docs/color)的 155 项为对照：39 个通用语义、40 个色系角色、19 个语法高亮、56 个数据配色，以及 1 个 brand。另维护 8 个项目扩展，因此 Colors 页展示 163 项，其中 162 项已赋值角色直接或间接引用 Tailwind 基础色板。`--color-background-control` 独立表达 Luma 控件底色，`--color-text-control-secondary` 表达该底色上的占位文字与辅助文字，`--color-background-sidebar` 保留 Luma 侧栏浅色 neutral-50、深色 neutral-900 的独立底色，不改写通用 surface、muted、neutral 或 secondary 角色。brand 使用 `--color-brand: initial` 保留待配置。配置及项目覆盖记录在 `apps/ui/ui-next/preset.json`，首次接入时的官方 registry 配置在 `design/themes/ui-next-luma.registry.json` 留存，组件来源及哈希记录在 `design/themes/ui-next-luma.sources.json`，MIT 许可保留于 `design/licenses/shadcn-ui.txt`。

已接入的视觉配置为 shadcn preset `b5F2gjwQRE`：Luma、Neutral、Sky 图表色、Noto Serif 标题、Noto Sans 正文、Hugeicons，以及 Default / Solid 菜单与 Subtle 菜单高亮。`apps/ui/ui-next/components/` 中的十二类组件以官方 `base-luma` 源码为基础，保留 Base UI 交互与 Luma 的尺寸、布局和状态样式，并将颜色与焦点类转换为当前语义接口。

项目将 Medium 圆角基准从 `.625rem` 覆盖为 `.5rem`（默认根字号下为 8px），`--radius-element` 为单一基准。语义 inner、container、page 分别取基准的 0.6、1.4、2.6 倍；`radius-chat` 独立保留 28px，none/full 继续用于直角与胶囊。Tailwind 的 sm/md/lg/xl/2xl/3xl/4xl 分别取基准的 0.6/0.8/1/1.4/1.8/2.2/2.6 倍，默认解析为 4.8/6.4/8/11.2/14.4/17.6/20.8px。

普通 CSS 变量分别声明浅深色的语义映射，不依赖 `light-dark()`、Astryx 运行时或组件包。Noto Sans 与 Noto Serif 从本地 Fontsource 变量字体依赖加载；中文分别使用本地 Noto Sans SC 与 Noto Serif SC 回退，之后保留系统 sans-serif/serif 回退。Typography 的 xs/sm/base/lg 等字号使用 Tailwind 标准值 12/14/16/18px，既有语义名称、字重与行高接口继续维护。

Neutral preset 的数值通过用途映射到 Astryx 语义角色：shadcn 的 primary 对应强调填充，accent 对应柔和交互背景。普通表面上的辅助文字浅色采用 neutral-500、深色采用 neutral-400；控件内部的占位文字与辅助文字使用独立的 `text-control-secondary`，浅色采用 neutral-600、深色采用 neutral-400，覆盖柔和控件底色上的对比度需要。统一焦点采用强调边界灰度；状态文字、状态填充和 on-* 前景仍成对维护。

按原版控件效果，Input、InputGroup、Textarea、Select 与 NativeSelect 使用 `bg-control border-transparent`。`--color-background-control` 在浅色引用 neutral-200 的 50% 混色，深色引用 white 的 7.5%；`--color-track` 分别使用 neutral-200 的 90% 与 white 的 13.5%。这些透明值在实际表面上合成，所有基础色仍来自 Tailwind。默认填充不再采用此前加深的描边，键盘焦点与 invalid 反馈独立保留；不能将旧的控件边界对比度采样结论套用到此版本。菜单强调按用户最终截图采用 Subtle，列表项使用系统 full 圆角形成胶囊。

`@theme reference inline` 将工具类直接指向语义变量，并避免 Tailwind 的同名变量覆盖原始角色。模式通过 `.ui-next-theme` 上的 `data-ui-theme="light|dark"` 明确选择，默认浅色。切换主题不会改写现有版偏好。

| 用途 | 新版接口 |
| --- | --- |
| 文字与图标 | `text-primary`、`text-secondary`、`text-control-secondary`、`text-accent`、`text-disabled`、`text-icon-*` |
| 表面 | `bg-body`、`bg-surface`、`bg-sidebar`、`bg-card`、`bg-popover`、`bg-muted`、`bg-control`、`bg-inverted`、`bg-error-inverted`、`bg-track` |
| 色系 | `bg-blue-bg`、`border-border-blue`、`text-icon-blue`、`text-blue`，其他九个色系同理 |
| 语法高亮 | `text-syntax-*`；背景与差异填充使用 `bg-syntax-background/added/removed/diff-header` |
| 数据配色 | `bg-data-*`，同一 Tailwind 颜色接口亦支持 `fill-data-*` 与 `stroke-data-*` |
| 品牌 | `bg-brand`，当前待配置 |
| 强调操作 | `bg-accent-bg text-on-accent` |
| 状态 | `bg-success-muted text-success`；实心使用 `bg-success-bg text-on-success`，warning/error 同理 |
| 反馈与焦点 | `interaction-layer`；强调填充再加 `interaction-accent`；`focus-visible:focus-ring` |
| 默认边框 | `border`、方向边框与默认分隔线读取 `--border-width`；`border-0/2` 等显式宽度保持独立 |
| 排版 | `type-display-1/2/3`、`type-heading-1` 至 `type-heading-6`、`type-large`、`type-body`、`type-label`、`type-supporting`、`type-code` |
| 尺寸与圆角 | `h-element-sm/md/lg`、`size-element-sm/md/lg`（32/36/40px）、`rounded-inner/element/container/page/chat`（4.8/8/11.2/20.8/28px） |
| 阴影与动效 | `shadow-sm/md/lg`、`shadow-inset-hover/selected/success/warning/error`、`duration-fast-min/fast/fast-max/medium-min/medium/slow`、`ease-standard` |

通用状态色用于文字；实心状态填充使用独立的 `*-fill` 角色并配对 `on-*` 前景。不可将 `bg-warning text-on-warning` 当成正确配对。交互层叠加颜色，不替换原始填充；禁用控件不会显示悬停或按压反馈。

交互过渡与进入／退出动画共用语义时长和 `ease-standard`。时长 utility 同时设置 transition、animation 时长及 tw-animate 使用的运行时变量；缓动同时覆盖两类效果。原 100/150/200/300ms 的组件交互分别映射到既有标尺的 fast-min 95ms、fast-max 165ms、medium-min 225ms、medium 300ms，不新增时长值。Spinner、Skeleton 等持续加载指示保持自身节奏；不确定 Progress 继续使用 slow 的两倍，减弱动态时保留静态可见状态。

此次接入改变此前的 Astryx 候选配色、字体、控件高度、字号及圆角数值；语义 token 名称与 Tailwind 基础色板引用契约保留，阴影几何与动效标尺继续独立维护。尚未移植 Astryx 的自适应字号、domain、组件主题覆盖与主题生成器。已导入的 Luma 组件将 `bg-primary` 等默认类按实际用途转换，避免混用 shadcn 与 Astryx 的 primary/accent 定义。

对比度验收针对明确的前景／背景配对：正文与语法文字至少 4.5:1，功能图标、强调边界及焦点与其实际背景至少 3:1。透明色先在目标背景上合成，再计算 sRGB 相对亮度。禁用色只记录，不强制正文阈值；装饰分隔线不作为唯一控件识别边界。数据系列色不承诺任意相邻组合都可区分，仍需要标签或其他编码。此验收不等于对未来整套组件宣称 WCAG 全面合规。

所有键盘焦点继续使用同一组 `focus-outline-*` 与 `focus-visible:focus-ring`。Best Practices 不复制 StyleX import、Astryx `elevation`/`gap` props 或主题 registry，也不通过文档调整改变现有交互。

展示页与组件使用 Hugeicons 和新版纯 `cn` 工具；Palette 复制与成功反馈、Icons 目录及用法示例同步使用 Hugeicons。弹层通过新版主题作用域继承当前模式。6016 保持独立入口，未导入现有版主题或业务组件，也未抽离共享发布包；业务 UI、现有外观设置和原生 palette 接入留给后续迁移。

## Typeset 内容排版

[Typeset 文档与真实 Markdown 预览](http://127.0.0.1:6016/?path=/docs/ui-next-typeset--docs)已接入 UI-next，源码固定到上述 shadcn/ui 提交。`typeset.css` 保留官方内容规则，`typeset-theme.css` 提供 `.typeset-memocard` 预设；来源、适配说明及本地 SHA256 记录在 `design/themes/ui-next-typeset.sources.json`，沿用 shadcn MIT 许可。

`@ui-next/components/typeset` 的原生 div 封装组合 `.typeset typeset-memocard`，支持 div props、ref、style 和 className。正文、标题与代码分别读取现有 body、heading、code 字体；颜色、边框、焦点和圆角读取现有语义角色。Typeset 接入新增 `--text-reading-leading: 1.75` 与 `--spacing-reading-flow: 1.25em` 两个阅读角色；补齐独立侧栏底色后当前共 230 项基础定义、163 项颜色角色。All tokens 与 Typography 在 Reading Rhythm 中各列出这两个角色一次。

正文桌面为 16px，窄于 48rem 时沿用官方 1.125 倍阅读字号（默认 18px）；阅读标题按正文比例派生，宽度由页面布局负责。按钮、表单和导航继续使用各自的紧凑 UI 排版与尺寸。内容层使用 `<Typeset><YourMarkdownRenderer /></Typeset>`，不要把整个 UI 页面套入其中。带 `data-slot` 的组件受后代选择器保护；使用 `.not-typeset` 或 `[data-not-typeset]` 可显式退出，包含自身及嵌套的 Typeset 根。退出区继续正常继承父级属性，组件自身仍应声明必要的基础样式。

预览使用当前 ReactMarkdown 与 remark-gfm 渲染中英文、嵌套列表、任务列表、引用、代码和宽表格。宽表格包在带名称、键盘焦点和焦点轮廓的 `.typeset-scroll` 区域内；追加按钮用于检查旧内容位置与输入状态的稳定性。Typeset 负责样式，内容解析、清理和安全处理由渲染层负责。本次未迁移生产笔记、编辑器或 Web/H5 业务页面。

## Storybook 外观设置

新版工具栏提供明暗模式、圆角基准、标题字体和正文字体。默认继续使用项目 8px、Noto Serif 标题和 Noto Sans 正文。圆角选项为 Default（项目 8px）、None（0）、Small（0.45rem）、Medium（0.625rem）、Large（0.875rem）；后三档对齐 shadcn Create 的配置值，Default 明确保留项目覆盖，不把它标成官方 Medium。调整基准后，inner/container/page 与 Tailwind 派生圆角同步变化；显式 full 圆形／胶囊和独立的 chat 角色维持自身语义。

标题与正文各提供 26 个可用选项（25 个本地 Web 字体与系统等宽），标题另可选择“跟随正文”。字体按选择动态加载本地 Fontsource CSS，并等待真实字体资源加载；中文分别保留 Noto Sans SC Variable／Noto Serif SC Variable 回退。代码字体继续读取独立的 code 角色。

这些设置使用 Storybook globals，Docs、Canvas、Typeset、Portal 与 Foundations 当前值同步响应；文档到 Canvas 和规范页之间的链接携带完整设置。`preview-appearance.css` 同时覆盖 HTML 根与每个 `.ui-next-theme` 的三个语义角色，保持当前基础 `theme.css`、预设文件及 230 项定义不变。TokenPage 在设置变化及字体加载后重新测量。

所有 Docs 复用既有 `componentDocsRenderer`，避免 Storybook 10.6 在 globals 更新时给 ErrorBoundary 随机 key，进而重挂载并清空示例输入。实际浏览器已验证字体／圆角切换保留 Docs 和 Canvas 的输入、追加内容状态；5 档圆角覆盖明暗两种模式，26 个选项的实际渲染字体逐一检查。320px 深色内容无页面溢出，默认配置下明暗模式各 37 个 Card 的几何继续匹配基线。类型、ESLint、35 项测试及静态构建通过，详细记录在 `build/verification/preview-appearance/`。设置仅用于 6016 预览，不读写现有版或生产外观偏好。

## 检查

2026-10-22 已在运行中的 6016 完成本轮验收：十二类组件的真实交互、键盘焦点、弹层主题继承、Noto 中英文字体实际加载、Hugeicons、8px 基准与派生圆角均已核验。十二个组件 Docs 在明暗模式、桌面与 320px 窄屏下的 48 项布局检查，以及十个 Foundations 页的 40 项检查均通过；文档页签、代码复制、Canvas 跳转与主题切换保留页签已实测。

首次接入时的源契约检查保留 225 个原始定义名，当时 160 个颜色角色中 159 项已赋值；288 项基础色板在明暗模式下与接入前一致。当时核验的 562 项配对与 15 项组件采样记录保存在首次接入报告中。随后通过两个项目定义分别维护控件底色与控件内部辅助文字，共 227 项基础定义；Typeset 接入后另增两个阅读节奏角色至 229 项；2026-10-23 补齐独立侧栏底色后为 230 项。保留原始定义名及 Luma 的柔和控件填充。旧采样结果不作为当前控件边界或辅助文字配对的对比度结论。brand 继续待配置。

以下类型检查、定向 ESLint 与 Storybook 构建均通过，最终新开页面无控制台警告或错误。本地报告与截图位于 `build/verification/ui-next-luma-import/verification.md`；官方来源与许可证留存在上述 `design/themes/` 和 `design/licenses/`。

```sh
pnpm --filter @memocard/ui typecheck:ui-next
pnpm --filter @memocard/ui exec eslint ui-next .storybook-next vite.storybook-next.config.ts
pnpm --filter @memocard/ui build:storybook:ui-next
```

正式 App 继续使用现有入口；新版预览不连接真实笔记库。

## 组件文档模板

十二类组件分别使用 Overview / Properties / Accessibility 文档模板，保留 `components/Luma` 总览。Overview 包含主要预览、用法（描述、Code、复制代码与 Canvas 入口）、组成和最佳实践；Properties 列出实际封装与 Base UI 的主要属性；Accessibility 说明名称、键盘、焦点和状态要求。示例导入路径使用 6016 独立的 `@ui-next/components/*` 别名，避免引用现有版组件。文档模板仅依赖新版组件、主题和 Hugeicons。

[文档模板 / 通用组件文档](http://127.0.0.1:6016/?path=/docs/ui-next-component-docs-template--docs)提供独立的模板说明、可提交表单、标题预设与自由编辑、重置及接入代码。模板示例和十二个组件页共同使用 `ui-next/ComponentDocsTemplate.tsx`，由 `ComponentDocsTemplate` 接收 `name`、`description`、`hero` 和三个内容槽位；`ComponentDocsExample`、`ComponentDocsSource`、`ComponentDocsBestPractices` 维护示例、代码和推荐／避免表格。`ComponentDocs.tsx` 只负责把现有十二类组件的内容传给共享模板。

文档排版读取当前 token：桌面标题使用 4xl（36px），窄屏使用 3xl（30px），章节标题使用 2xl（24px），正文使用 base（16px），导航、代码和辅助说明使用 sm（14px）；间距、边框、圆角与焦点直接引用现有语义变量。模板不另设颜色或排版 token。文档页签沿用 Luma 的手动激活行为：方向键移动焦点，Enter／空格激活；Properties 保持挂载，保留当前会话的输入。

主页签与示例详情页签均直接使用 Luma `line` 默认样式，文档不覆盖触发器的宽度、颜色、间距或指示线；窄屏仅在外层局部滚动，聚焦页签会进入可见范围并为焦点轮廓保留空间。所有文档表格（含单元格说明和行内代码）使用 sm（14px）；代码容器与代码文字均明确使用 sm，避免继承正文的 16px 行框。组成列表恢复圆点标记。用法和参数示例的组件预览整体水平、垂直居中，组件内部文字保留自身排版。

模板统一后完成 13 个文档 × 明暗模式 × 桌面／320px 窄屏的 52 项布局检查，覆盖 156 个页签状态；标题、预设、重置、表单、复制代码、Canvas 与主题切换保留状态均通过。完整模板代码和表单代码通过当前配置的类型检查。此次报告与截图位于 `build/verification/ui-next-template/verification.md`。

后续样式调整又完成 52 项共享文档样式检查及 52 项预览居中检查，覆盖相同文档、明暗模式与宽度；字号、两组 Tabs、圆点列表、页面无横向溢出及预览边界均通过。记录位于 `build/verification/ui-next-docs-style/`。

### Luma preview-02 展示验收

33 张卡片按官方顺序与七轨布局展示，新增 23 类组件及统一模板的 Docs / Example Canvas。35 类组件通过桌面浅色与 390px 深色的 70 项浏览器检查；当前单滑块、选择器、通知、页签、折叠面板、日期与设备控制的实际交互已核验。文档代码通过真实 API 类型检查，重复实例无 ID 或标签关联冲突。

卡片列不使用会裁切阴影的绘制 containment；搜索框采用 `bg-muted border-border`。保留 8px 基准和所有主题定义数值，补齐新组件的默认语义边框色与运行时变量映射。检查记录见 `apps/ui/ui-next/design-qa.md`。


### Token 应用复核修复

2026-10-22，本轮修复 Base UI 的状态 className 回调、Checkbox／Radio 禁用视觉与 mixed 指示、Sheet Portal 边框，并将标准控件高度与交互动效接入现有语义 token。控件内部占位及辅助文字使用独立的 control-secondary 角色；通用辅助文字、柔和控件填充、8px 基准及菜单胶囊不变。Tailwind 合并规则支持语义尺寸、时长和缓动的调用方覆盖。

当前 UI-next 类型检查、包含 Hooks 的定向 ESLint、27 项回归及静态构建通过。组件与 Foundations 完成桌面浅色／390px 深色的 90 项渲染布局检查；关键状态、尺寸和动效 token 覆盖、减弱动态及四方向 Portal 已实测。37 个桌面 Card 的几何与此前基线一致，窄屏首卡仍为 316.5703×622px。详细范围、证据及对比度结论见 `apps/ui/ui-next/design-qa.md` 和 `build/verification/token-system-fixes/`。未迁移生产 UI、提交 Git 或发布。

### Typeset 接入后复核

Typeset 接入后再次完成 35 类组件及 11 个 Foundations 的 92 项明暗／宽窄渲染布局检查。修复 ItemSeparator 未解析 Base UI 状态 className 回调，以及文档圆点列表规则泄漏到 Sidebar/Breadcrumb 的问题；同时补齐 Typeset 自身和嵌套根的退出规则。Typeset 的变量覆盖、宽表格键盘滚动、内容追加稳定性、显式退出与组件隔离均已在浏览器验证。37 个桌面 Card 的几何继续匹配此前基线。

当前类型检查、定向 ESLint、5 个文件的 32 项回归测试及静态构建通过。首次与构建并行运行时有一项 Slider 测试超时，保留原日志，降低并发独立重跑后全部通过，未修改超时设置。记录见 `build/verification/typeset-integration/` 和 `apps/ui/ui-next/design-qa.md`。本轮结论覆盖 UI-next；真实设备与业务页面迁移仍需各自验收。

### 业务组件迁移与新版 Web/H5

业务组件层现已提供 Sidebar、标签导航、NotePreview、NoteCollection、搜索、快速记录、Editor/Rich、属性编辑、回收站与删除确认的新视图。新视图消费 UI-next token、基础组件、Hugeicons 与 Typeset；原生入口暂保留旧视图。Markdown 清理/链接、草稿、搜索会话、保存、附件、属性写入和撤销逻辑从原实现提取并共享，不维护两份业务控制器。

新版 Web/H5 使用同一 App 控制器的 `AppViewState` 投影，入口为 `apps/ui/ui-next/web/main.tsx`。桌面使用侧栏与页面搜索，窄屏使用抽屉、底部快速记录与保留会话的搜索面板。主页固定、标签筛选、布局偏好、草稿恢复、回收站预览/恢复及权限控制已接入。外观设置接入主题、圆角、标题字体和正文字体，代码字体独立；使用单独的 `memocard-web-appearance-v1` 偏好键，等待后续原生适配。

运行与构建：

- `pnpm --filter @memocard/ui dev:web-next`：独立浏览器入口 `http://127.0.0.1:5180/`；连接文件夹时仍使用现有浏览器存储能力与授权流程。
- `pnpm --filter @memocard/ui build:web-next`：构建到独立的 `apps/ui/dist-web-next/`，不覆盖原生使用的 `dist/` 或 Apple 资源。
- `pnpm --filter @memocard/ui storybook:ui-next`：`http://127.0.0.1:6016/?path=/story/ui-next-web--workspace` 提供完整内存笔记库示例，另有保存失败、草稿恢复、空库与授权状态。示例不连接真实文件。

共享 App 目前仍可到达旧原生视图的延迟代码。新 Web 和 UI-next Storybook 的 `uiNextStyleBoundary` 显式排除 `src/` 的旧视图 CSS，防止打包器把旧样式附到公共代码块后覆盖新组件。共享内容所需的 KaTeX 等依赖样式与每个新版视图自身的 CSS 保留。原生构建配置未使用这一边界。

最终检查：新版20套194项测试通过，含5项完整页面集成；关键旧版 App/回收站120项、Editor/Rich213项及各模块旧版回归通过；新旧入口类型检查、定向 ESLint、独立 Web 构建与144条目 Storybook 构建通过。浏览器完成桌面编辑保存后搜索命中、H5搜索返回保留会话、快速记录刷新、属性展开/日期面板、固定、回收站删除→预览→恢复，以及320px深色设置页无横向溢出；独立 Web 设置重载后仍保留。证据见 `build/verification/web-h5-migration/`。

这是代码迁移与本地浏览器验收完成的状态；未提交、发布或替换已安装客户端。未使用真实笔记库执行写入验收，iOS/Mac原生重做、手机软键盘/手势/安全区真机验收仍待后续。

### 业务交互与旧版对照复核

后续完整复核与修复结果见[新版UI与旧版功能交互对照审查](ui-next-review.md)。新版240项、关键旧版307项回归及最终Web/152条目Storybook构建通过；报告分别记录源码、自动化、真实浏览器与待真机验收，不把静态依赖图的性能降幅当作首页流量或耗时实测。


## Sidebar-10 页面骨架重新对齐

2026-10-23按新的用户要求完成单独一轮模板复核。旧版确实以Sidebar-10为来源；此前UI-next功能审查不等于模板保真验收。本轮恢复官方槽位和旧版现有Web/H5业务布局，继续使用新版token与组件，详见[对齐矩阵与验收](ui-next-sidebar10.md)。
