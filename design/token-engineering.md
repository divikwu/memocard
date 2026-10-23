# Token 工程维护与集成

Storybook 的 All tokens 用于查阅名称、数值、色样与尺寸预览，表格仅显示工具栏当前亮／暗模式与配色下的值；分类页保留字体、按钮尺寸与动效演示；完整焦点与动效回归保留在 Canvas。本页承接工具类映射、运行时输出、维护归属和使用方式。

展示范围不改变定义范围。完整记录仍由 [registry](tokens/registry.json) 登记，[覆盖清单](token-coverage.generated.md) 与 [结构化目录](token-coverage.generated.json) 自动生成。当前登记全部 629 项静态 CSS 定义、13 项运行时输出、28 项可移植尺寸、18 项所有权契约和 4 项上游定位输出；Storybook 主表展示其中的 345 项非适配层 CSS 定义和全部尺寸基准。数据与完整语法色板按需导入，登记与目录展示不等于已加载到产品入口。

标注的背景、文字和菜单样本统一在 `import-layout.tokens.css` 维护。文字 token 按浅深色覆盖，菜单 swatch token 沿用原有固定色值；默认仍消费 foreground。具体角色与消费者见 [Token 消费映射](token-consumption.md)，浅深色浏览器回归会覆盖实际变量，检查正文、标题和生产菜单确实读取这两组 token。

Skeleton 的 --skeleton-bg 默认引用原 accent，保持加载占位外观；可独立覆盖而不改变选中表面。普通图标的 primary / secondary 默认与正文主色／次色等值，但可独立覆盖。Select、菜单、输入附属图标、面包屑、搜索与格式工具使用图标角色；状态图标和填充按钮内图标继续跟随各自前景，禁用角色优先。

成功与警告使用 Tailwind 既有绿色／琥珀色阶，浅色为 green-800 / amber-800、深色为 green-400 / amber-400；它们不随用户强调色切换。Alert 的弱化提示与 Badge 的实色标签新增 success / warning 变体，原 destructive Alert 变体读取 error-muted，Button / Badge 的破坏性变体读取 on-error。没有把现有信息通知改为成功或警告。弱化背景透明度按真实底色合成验证，不把浅色背景当成可直接承载白字的实色填充。

Dialog / Sheet 与属性确认弹窗的 surface / on-surface 默认等于既有 body / foreground，遮罩保留 body 80% 和原模糊；Tooltip 的 inverted 默认等于 foreground，on-inverted 使用固定 on-dark / on-light，箭头同源。Switch 未选中轨道保留原 input（深色 80%），选中和禁用状态仍由原角色控制。accent-muted 保留原选区强调色 22%，border-emphasized 保留原属性复选框边界颜色。以上角色都可独立覆盖，字号、圆角、动效与原生 palette 协议不变。

## Astryx 后续对齐进度

基准为 facebook/astryx `f94e9622941e4997b0d6af7fc717ccc3d5cefaa6`。目标覆盖下列各项，不以定义数量代替消费和运行验证。字号、字重、行高、圆角公式、动效数值及原生 palette 协议保持；既有未提交和并行 MCP 改动保留。

| 项目 | 当前状态 | 完成证据或后续工作 |
| --- | --- | --- |
| 控件尺寸与普通边框 | 已验证 | Button / Input / InputGroup / Select / Tabs / Textarea 共用尺寸；默认 border、方向边框、CSS 边线和分隔线共用 width。18 项 Chromium / WebKit 密度检查覆盖 100–200% 根字号、独立覆盖和调用方覆盖。 |
| 低／中／高与状态阴影 | 已验证 | 浮层、表面和轻控件迁入三个层级；输入 hover / success / warning / error 和 outline 按钮持久选中读取独立 inset。完整 Web 门禁、主题／组件浏览器、Docs 与错误态键盘焦点检查通过；其余对齐项目仍按下表继续。 |
| 多色语义与缺失颜色角色 | 已验证 | 十种公共色相与棕色扩展的四个角色、on-dark/light、tint-hover、shadow、error-inverted 及 border-strong；107 项浏览器及 2 项 Docs 通过，标签／Callout 配色与原生标签采样保持。 |
| Astryx 公共命名与消费收口 | 已验证 | 79 个核心颜色角色与 64 个颜色 bridge 后缀齐全；字体、间距、七档字号、三档字重、圆角和四类过渡按原标尺验证，Skeleton 可独立覆盖。保留差异逐项见下表。 |
| 数据／语法高亮领域接口 | 已验证 | 56 项数据色、19 项语法／diff 角色，独立编译与 70 项 Chromium / WebKit 浏览器检查、完整 Web 门禁与 Docs 通过。代码块背景已接入，完整数据／高亮配色按需加载。 |
| 主题定义、继承与生成 | 已验证 | defineTheme、生成轴、JSON 继承／预编译、Provider 和原生颜色／圆角已接入；生产运行时工厂的消费索引、反例与隔离构建通过，完整 Web 门禁及 Docs 复验通过。 |

控件尺寸保持既有根字号基准：xs / sm / md / lg 为 24 / 32 / 36 / 40px，Textarea 最小 64px；以 rem 定义并随根字号缩放。Astryx 核心默认的 sm 28 / md 32 / lg 36px 不覆盖 MemoCard 当前密度。Tailwind 的 `--size-*` 只生成 `size-*`，高度同时提供 `--spacing-element-*` 生成 `h-element-*`。类名合并器登记这些后缀，保证 `className="h-12"`、`size-6`、`h-auto` 等调用方覆盖生效。普通边框 1px 不随根字号缩放；显式 0 / 2px 等宽度保留。

`shadow-sm / md / lg` 现在分别消费 low / med / high，默认使用原轻控件、表面和浮层阴影。原生 palette 不消费这些层级。属性确认弹窗的 `shadow-lg` 随统一映射采用与其他浮层一致的 high；原 `--control-shadow / --surface-shadow / --overlay-shadow` 及旧工具类保留兼容读取，新的主题覆盖和生产组件消费使用 canonical 层级。快速记录的聚焦表面、底部悬浮控件继续使用各自专用阴影。

输入的 `input-state` 在 hover、`data-validation="success|warning"` 和 `aria-invalid=true` 时读取对应 inset；错误优先于其他校验，hover 不覆盖校验且排除禁用。InputGroup 只在外框绘制，内部 Input / Textarea 不重复；错误仍由调用方提供 `aria-invalid` 与错误说明。outline Button 的 `aria-pressed=true` 使用 selected inset，持久选中与临时按压保持不同。四项 focus-outline 和原动效数值不变。

## 工具类映射

[theme/tokens.css](../apps/ui/src/features/theme/tokens.css) 的 `@theme inline` 参考 [Astryx token](https://astryx.atmeta.com/docs/tokens) 与其 Tailwind bridge 的分工，将 MemoCard 既有值映射为按用途命名的工具类。`primary` 现在表达正文主色；强调操作使用 `accent-bg / on-accent`。这是公共接口迁移，旧 `bg-primary`、`text-muted-foreground` 等用法已从组件和故事迁出，不提供含义冲突的旧类名兼容层。

| 用途 | 新工具类 | 唯一数值来源 |
| --- | --- | --- |
| 正文 / 辅助文字 | `text-primary` / `text-secondary` | `--foreground` / `--muted-foreground` |
| 强调文字 / 固定图标 | `text-accent` / `text-icon-accent` | `--text-accent-color` / `--accent-text` |
| 普通图标主色 / 次色 | `text-icon-primary` / `text-icon-secondary` | `--icon-primary-color` / `--icon-secondary-color` |
| 禁用文字 / 图标 | `text-disabled` / `text-icon-disabled` | `--text-disabled-color` / `--icon-disabled-color` |
| 页面底色 | `bg-body` | `--background` |
| 卡片 / 浮层 | `bg-card text-on-card` / `bg-popover text-on-popover` | 各自既有背景与 foreground 配对 |
| 通用表面 / 反色背景 | `bg-surface text-on-surface` / `bg-inverted text-on-inverted` | `--surface-bg / foreground`、`--inverted-bg / foreground` |
| 遮罩 / 轨道 / 弱化强调 | `bg-overlay` / `bg-track` / `bg-accent-muted` | `--overlay-bg` / `--track-bg` / `--accent-muted-bg` |
| 成功 / 警告 | `text-success bg-success-muted` / `text-warning bg-warning-muted`；实色填充分别配 `text-on-success / warning` | `--success / muted / foreground`、`--warning / muted / foreground` |
| 错误弱化背景 / 填充前景 | `bg-error-muted` / `text-on-error` | `--error-muted` / `--error-foreground`；错误主色仍为 destructive |
| 强调边界 | `border-border-strong`；兼容 `border-border-emphasized` | `--border-emphasized-color` |
| 固定前景 / 强错误底色 | `text-on-dark / on-light`、`bg-error-inverted text-on-error` | `--on-dark-color / on-light-color`、`--error-inverted-bg` |
| 悬停染色 / 阴影色 | `bg-tint-hover` / `bg-shadow` | `--tint-hover-color` 同时派生 hover / pressed；`--shadow-color` 进入 high 层级 |
| 公共多色 | `bg-blue-subtle border-blue-ring text-blue-vivid`、`text-blue-icon`，其余十色同结构 | `hues.css` 中每色 background / border / text / icon 四个角色 |
| 强调操作 | `bg-accent-bg text-on-accent` | `--primary` / `--primary-foreground` |
| 中性操作 | `bg-neutral text-on-neutral` | `--secondary` / `--secondary-foreground` |
| 弱化表面 / 选中表面 | `bg-muted` / `bg-state text-on-state` | `--muted` / `--accent` / `--accent-foreground` |
| 悬停叠加 / 加载占位 | `bg-overlay-hover` / `bg-skeleton` | `--hover-bg` / `--skeleton-bg`；占位默认引用 accent，可独立于 state 覆盖 |
| 按压叠加 | `bg-overlay-pressed`，控件按压自动叠加背景图 | `--pressed-bg` |
| 错误 / 边线 / 输入 / 焦点 | `text-error` / `border-border` / `border-input` / `focus-visible:focus-ring` | `--destructive` / `--border` / `--input` / `--focus-outline-*` |
| 侧栏 | `bg-sidebar text-sidebar-text`、`bg-sidebar-hover text-sidebar-on-hover` | 既有侧栏颜色；键盘焦点与其他控件共用 focus-outline token |
| 阴影层级 | `shadow-sm` / `shadow-md` / `shadow-lg` | `--shadow-low` / `--shadow-med` / `--shadow-high` |
| 状态内阴影 | `inset-shadow-hover / selected / success / warning / error` | `--shadow-inset-*` |
| 控件尺寸 | `h-element-xs / sm / md / lg`、`size-xs / sm / md / lg`、`min-h-textarea` | `--size-element-*`、`--size-textarea-min` |
| 普通边框 / 分隔线宽度 | `border-(length:--border-width)`、方向边框及 `h-(--border-width)` | `--border-width` |

`state / on-state`、`on-card / on-popover / on-neutral`、`input / focus` 及侧栏是 MemoCard 的适配角色；不强行合并原本可独立覆盖的值，也不为对齐 Astryx 目录新增无消费者的状态。所有 `--color-*` 都能生成不同 CSS 属性的工具类，按上表角色选择；例如 `bg-primary` 虽然可以编译，含义已是正文颜色，不能再用作强调按钮。旧 shadcn 组件代码导入本项目时必须迁移颜色类名。

字体、字号/行高/字重、间距和圆角继续消费现有标尺：`font-sans / font-heading`、`text-sm`、`type-body`、`p-4 / gap-2`、`rounded-md`。排版映射由 `scale.ts` 生成，动效默认值由 `features/motion/tokens.css` 的 `@theme inline` 提供，不复制到第二份主题表。`hover:bg-hover-overlay` 是现有的背景图叠加辅助类，继续引用 `--hover-bg`，与设置背景色的 `bg-overlay-hover` 分别保留。

底层 CSS 变量及 `IOS_PALETTE_KEYS` 保持原契约，直接 CSS 引用与组件局部覆盖继续生效。标签的原生 RGBA 采样保持；蓝色 primary 的采样随下述对比度修复变深，协议字段不变。`theme-tokens` 浏览器测试在 Chromium / WebKit 覆盖浅深色、八种强调色和两种中性色的全部 32 种组合，检查新工具类、真实 Button / Skeleton 与底层值一致，并检查局部状态覆盖及表面阴影。

颜色适配层定义引用已有权威值，不另行维护一组默认色。它们仍列入覆盖清单的“公开 CSS 定义”，以 `adapter` 层标记；Storybook 不再重复展示对应色样。修改语义定义或映射关系时，继续验证依赖链、主题覆盖和生产消费者。

强调文字 `--text-accent-color` 和固定图标 `--accent-text` 使用浅色 accent-700 / 深色 accent-400，mono 保留原 accent-500。操作填充仍由 `--primary` 拥有，blue 改为 accent-600 配白字，其余填充保留；独立覆盖文字不会改变填充。32 种主题组合分别检查真实 Button 白字、链接在 body/card/popover 上达到 4.5:1、固定图标达到 3:1。字号、字重、行高、圆角和动效值保持。

`hues.css` 提供 Astryx 十色与兼容内容用的 brown，每色四个角色独立覆盖。Tag 的既有前景别名接入公共文字角色，背景仍由原透明度派生，旧 tag-* 覆盖与原生采样继续有效。Callout 同名颜色原本不同，因此在组件作用域把公共 background/text 绑定到既有 callout-* token；根级 hue 覆盖不会重绘已保存 Callout。覆盖 callout-* 或组件局部公共角色均可定制。公共 ring/icon 尚无对应产品业务入口，以真实 Badge 和图标验证可编译、可渲染、可独立覆盖，不将其描述为新业务功能。

禁用文字/图标默认分别引用当前中性色阶，浅色为 neutral-400，深色为 neutral-600，可独立覆盖。生产 CSS 同时识别原生 `:disabled`、Base UI `data-disabled` 和 `aria-disabled=true`，颜色优先于变体/选中颜色；原有禁止操作的代码和 ARIA 状态保持。填充按钮及开关使用既有 muted 表面，开关滑块使用禁用图标色。输入框组内的禁用输入不会把仍可操作的附加按钮染成禁用色；QuickCapture 的不可编辑文本同步暴露 aria-disabled。

`--pressed-bg` 在浅色使用 neutral-800 的 12% 混合，深色使用 neutral-200 的 24% 混合。可操作按钮、链接及相应 ARIA 控件在真实 `:active` 时使用背景图叠加；禁用控件排除。Sidebar 移除原 active 填充切换，保留 data-active 选中状态。松开后恢复既有 hover/默认背景，不修改变换、关键帧或过渡时长。

焦点四项为 width 2px、style solid、offset 3px，color 浅色 accent-700 / 深色 accent-400，避免亮配色直接作为焦点时对比不足。`focus-visible:focus-ring` 和原 CSS 消费者共用四项；输入框组与快速记录由外框显示，内部输入不重复描边。强制颜色模式保留系统 Highlight。Storybook 代码滚动区在裁切容器内使用宽度 token 的负偏移，其余文档表格沿用统一偏移。旧 ring / sidebar-ring 底层值保持兼容，不再定义新控件的焦点几何。

`theme-tokens` 在 Chromium / WebKit 检查全部 32 种模式/配色组合，焦点色相对页面、卡片、浮层和侧栏表面均达到 3:1；这不是整页无障碍合规结论。独立回归覆盖文字/填充分离、禁用文字/图标独立覆盖、原生/ARIA/Base UI 禁用状态、单圈焦点、四项焦点覆盖和真实鼠标按下/松开。macOS WebKit 使用 Option+Tab 遍历按钮，其他环境使用 Tab。

Elevation 分类页直接读取已安装 `tailwindcss/theme.css`：基础阴影为 `--shadow-2xs / xs / sm / md / lg / xl / 2xl`，内阴影为 `--inset-shadow-2xs / xs / sm`，轮廓投影为 `--drop-shadow-xs / sm / md / lg / xl / 2xl`。三组共用表头、列宽与预览布局；外/内阴影通过 box-shadow 展示，轮廓投影通过透明 SVG 的 filter: drop-shadow 展示，项目定义继续单列。16 项上游标尺不计入项目自有定义，也不重复放入 All tokens 项目目录。

通用 low / med / high 阴影由 `theme/tokens.css` 维护，分别通过 shadow-sm / md / lg 消费；旧 surface / control / overlay 变量与工具类保留兼容读取。三个层级默认沿用原轻控件、表面与浮层值，属性确认采用统一 high。五个状态 inset 使用同一主题定义；快速记录的聚焦表面与底部悬浮控件继续在 `theme/capture.tokens.css` 拥有两个专用角色，随 quick-capture.css 加载。项目定义展示 canonical 层级、状态 inset 与专用角色，旧适配别名不重复展示。保留 Tailwind 的阴影与 ring 组合以及既有模式覆盖；Docs 隔离采样器读取两份权威定义，具体消费见[消费映射](token-consumption.md)。

Elevation 仅保留 Docs，原 Diagnostics 入口隐藏但 ID 和测试保留。键盘打开、遮罩、Esc / 按钮关闭及焦点返回的可见检查归 Sheet / Interaction；系统媒体偏好演示归 Motion Docs，完整时长对比保留在隐藏 Reduced Motion 回归。共享夹具与断言供新入口和旧 ID 调用；完整图标、阴影及独立焦点检查仍在隐藏 Regression / Dark / Reduced Motion 中执行，token 定义和覆盖清单不受影响。

## 数据与语法领域接口

[domains/data.css](../apps/ui/src/features/theme/domains/data.css) 提供 Astryx 固定基准的 56 项数据角色：10 个 categorical、1 个 neutral，以及 blue / shamrock / orange / pink / purple / red / teal / yellow / gray 各五档顺序色。它们用于表达系列与强度，独立于用户操作强调色；gray 与 neutral 有深色覆盖。不要把系列颜色当作普通文字色或成功／失败状态。图表仍须提供标签、数字或其他非颜色编码。

[domains/syntax.css](../apps/ui/src/features/theme/domains/syntax.css) 提供完整 19 个语法／diff 角色：13 个语法前景、background、added / removed / diff-header 及两个 marker。背景在 [code.css](../apps/ui/src/features/theme/domains/code.css) 单独维护，由核心 Tailwind 入口加载，保持原 muted 默认值；完整语法模块会导入同一背景。Markdown 阅读视图和 RichMarkdownEditor 的代码块已消费该角色，文本、字号、间距和保存格式保持。历史 LiveMarkdownEditor 不在生产依赖图，不将其当作已接入生产的高亮器。

当前产品没有数据图表，也没有代码 tokenizer。完整领域模块提供真实 CSS 默认值和 Tailwind 接口，单独导入即可使用；不会因为登记目录就进入产品首屏。注册表的 optionalStylesheets 显式记录两个入口、可见示例与浏览器验证，生成器仍拒绝未登记的不可达定义；消费索引只展示真实生产依赖图。未被产品消费的系列／语法颜色仍标 reserved，表示消费现状，不是空值或占位 API。

```css
/* Tailwind 编译入口；已有应用样式仍是核心依赖。 */
@import "./src/styles.css";
@import "./src/features/theme/domains/data.css";
@import "./src/features/theme/domains/syntax.css";
```

```tsx
<rect className="fill-data-categorical-blue" />
<div className="bg-data-blue-3" />
<pre className="bg-syntax-background">
  <code className="text-syntax-variable">
    <span className="text-syntax-keyword">const</span>
  </code>
</pre>
<div className="bg-syntax-added text-syntax-added-marker">+</div>
```

覆盖 `--data-categorical-blue`、`--data-blue-3`、`--syntax-keyword` 或 `--syntax-background` 可独立定制对应角色；它们不改写 body / accent / status 或其他领域的定义。CSS 颜色工具类仍可生成多种属性，按角色选择使用。`--chart-1…5` 保留原兼容值与 reserved 状态，不把五个旧占位角色偷换成新数据色板。

语法默认值适配当前公共 hue 与状态角色。关键字混合 5% 正文色，comment / punctuation 混合 8% 正文色，使它们在代码背景及透明新增／删除行背景上均达到普通文字 4.5:1；实测覆盖全部 32 种主题组合和两个浏览器，未降低原阈值。语法配色只提供角色，不负责语言解析；没有以正则替换 Markdown 或改变笔记内容。数据系列色不作普通文字 AA 承诺。

Storybook 的 Domain Tokens 显示带数字／标签的分类柱图、九组顺序色、代码与 diff 示例；Color 和 All tokens 列出全部领域角色。编译回归逐项验证全部 75 个颜色后缀生成实际工具类，并验证仅导入核心与共用背景时不会生成 data 与 keyword 工具类；浏览器回归验证 SVG fill、语法文字、差异底色、独立覆盖与真实代码块背景兼容。

## 主题定义、继承与生成

[`defineTheme`](../apps/ui/src/features/theme/define-theme.ts) 接受 name、extends、tokens、localTokens、color、typography、radius、motion 与 syntax。字符串用于两种模式，二元组分别指定浅深色；输出采用原有 .dark 选择器，不提高 Safari 16.4 构建目标。主题只在调用方显式传入时应用，现有主入口继续使用原默认定义与偏好。

```tsx
const base = defineTheme({
  name: "brand-base",
  color: { accent: ["#0064E0", "#48CAE4"], neutralStyle: "cool" },
});
const brand = defineTheme({
  name: "brand",
  extends: base,
  color: { contrast: "high" },
  tokens: { "--text-accent-color": ["#064E8A", "#8FDFFF"] },
});
<ThemeProvider definition={brand}><App /></ThemeProvider>
```

合并顺序为继承后的平面 token → 本层声明的生成轴 → syntax → 显式 tokens。子主题的部分生成配置会补齐父主题的轴参数，例如提高 contrast 时保留已选 accent 种子；未声明的轴沿用父主题已解析结果，保留其显式 pin。localTokens 在同一家族内按名继承／覆盖，不能借此重定义已拥有的公共 token。生成结果包含全部继承值，使用子主题 CSS 时无需加载父主题 CSS。

可写名称由当前登记 CSS、计算行高及既有 portable radius 基准生成，现为 346 项；已内联的 Tailwind adapter 和只读兼容别名不作为修改入口。引用可使用已登记／上游名称及本主题声明的 localTokens。工厂拒绝未知字段／名称、不合法的值形状、无效 extends、未知引用和通过默认表达式产生的别名环；定义与轴数据隔离于输入并冻结。声明的是 CSS 值字符串，具体语义仍由使用角色决定。

| 生成轴 | 当前接口与职责 |
| --- | --- |
| color | accent 六位 hex 或浅深种子对、neutralStyle warm/cool/neutral、contrast standard/high。算法沿用固定 Astryx 基准的 CIELAB 近似 HCT，实现许可见 [astryx.txt](licenses/astryx.txt)，输出适配 MemoCard 的正文、表面、强调、边界与侧栏角色。仅 neutral 配置保留现有强调色；状态、内容 hue 和数据色不随种子生成。 |
| typography | scale.base 指定像素基准；省略 ratio 按当前七档比例缩放，base=16 完全保留现值；显式 ratio 使用等比标尺。行高继续按既有 4px 网格与最少 4px 空隙计算，八种文字角色引用同一标尺。body/heading/code 可声明 family 与 fallbacks；code 同时生成 --app-font-mono 和 --note-mono-font，字体文件由调用方加载；ThemeProvider / TypographyProvider 的用户字体偏好继续优先。 |
| radius | base 与可选 multiplier 只生成 --radius，原七种派生公式保持。省略时继续由用户圆角选择提供基准。 |
| motion | scale 作用于原 fast/normal/panel/pulse 数值，1 保留原值；reduced 时长与缓动曲线保持核心来源。 |
| syntax | 按既有 19 个角色指定 CSS 值，领域模块的加载职责保持。 |

生成的强调填充会配套生成前景；通过 tokens 单独修改 --primary 时，要由调用方同时选择合适的 --primary-foreground。完整重建强调配对使用 color.accent。内置生成回归检查强调配对和正文／辅助文字的 4.5:1，以及强边界与焦点的 3:1；这不是对任意显式覆盖或整页 AA 的承诺。

`ThemeProvider` 接入 definition，沿用已有模式、系统偏好、存储与两帧停用过渡流程。主题的显式 CSS 值覆盖底层缺省／配色表达式，未覆盖角色继续读取原偏好；字体与阅读偏好的 inline 输出继续具有更高优先级。组件的局部角色 CSS 变量可独立覆盖，Portal 从同一文档根读取主题。每个浏览器文档使用一个活动根主题；Storybook 的主题示例 Canvas 独立 iframe。

根样式生命周期也可通过 [ThemeStyle](../apps/ui/src/features/theme/ThemeStyle.tsx) 在已有 Provider 环境中应用。移除主题会清理所属 style 并恢复先前选择器，不保存新的主题偏好键。原生颜色观察增加 data-memocard-theme，继续使用原 IOS_PALETTE_KEYS 采样。显式圆角经 [ios-theme.ts](../apps/ui/src/lib/ios-theme.ts) 解析为 CSS px，复用原生 rowRadius 字段；px、rem 和 calc 长度可同步，依赖布局的百分比不能转换为单个原生逻辑点，沿用用户偏好。未应用定义或仍使用原 rem 基准时也沿用原偏好，避免仅改颜色的主题改变原生度量。没有新增协议字段；原生字体的 Dynamic Type、控件度量及 UIKit 动效仍由平台拥有，依据见下表。

构建时使用 JSON，extends 为相对父文件路径：

```sh
pnpm theme:build design/themes/ocean.json design/themes/ocean.generated.css
pnpm theme:build design/themes/ocean.json design/themes/ocean.generated.css --check
```

[ocean](themes/ocean.json) 继承 [ocean-base](themes/ocean-base.json)，生成 [独立 CSS](themes/ocean.generated.css)。check 检查漂移且不覆盖文件，相同构建保留 mtime，循环文件继承被拒绝。生产可导入该 CSS 后传入 `definition={{ name: "ocean" }}`；运行时无需携带生成器。根样式应用、构建入口、生成契约和样本的漂移检查均登记在 [registry](tokens/registry.json)，CLI 回归纳入 test:tokens。

运行时工厂与完整契约保持按需依赖；Tailwind 的默认生产扫描明确排除生成器／契约元数据，避免把其中的 CSS 表达式当成应用工具类。当前默认生产入口只增加轻量根样式控制与原生采样，完整生成器未从 main 可达。隔离副本把运行时工厂真正导入 main 后，消费索引与 Safari 16.4 目标构建均通过。生成契约位于 generated，按既有规则作为元数据处理；syntax 动态输出使用登记的精确表达式契约，索引为声明。契约需匹配所有者、输出范围与源表达式，真实 reserved 读取、未知引用、缺失／漂移契约仍被回归拒绝。

## 保留差异与适用边界

核对范围是固定基准的全部核心 token 分组、Tailwind bridge、data / syntax 与主题工厂的公开字段。这里的完成表示适用于当前 MemoCard 的语义与接口已接入，不表示复制 Astryx 的数值或组件运行时。上游依据为 [tokens.stylex.ts](https://github.com/facebook/astryx/blob/f94e9622941e4997b0d6af7fc717ccc3d5cefaa6/packages/core/src/theme/tokens.stylex.ts)、[Tailwind bridge](https://github.com/facebook/astryx/blob/f94e9622941e4997b0d6af7fc717ccc3d5cefaa6/packages/core/src/tailwind-theme.css) 和 [defineTheme.ts](https://github.com/facebook/astryx/blob/f94e9622941e4997b0d6af7fc717ccc3d5cefaa6/packages/core/src/theme/defineTheme.ts)。

| 对照项 | 当前实现与保留原因 |
| --- | --- |
| 底层 CSS 名称 | Tailwind 的用途后缀与 Astryx 对齐；底层沿用现有 shadcn / 原生 palette 变量，避免破坏局部覆盖与协议。它们不是 Astryx 原始 CSS 名称的逐字替换。 |
| spacingDefaults | 两者均以 rem 表达 4px 根基准。Tailwind 的 --spacing=.25rem 提供 p-* / gap-*，无需复制另一套 --spacing-0…12；100–200% 根字号下按相同比例缩放。 |
| typographyDefaults | font-sans / heading 读取原界面字体；font-mono 读取 --app-font-mono，默认精确保留原 Tailwind monospace 栈。笔记代码继续由 --note-mono-font 及阅读偏好拥有；显式 code 轴可同时设置两者，用户 inline 偏好仍优先。 |
| textSizeDefaults / typeScaleDefaults | 保留七档项目字号和八种文字角色，现有 heading-1…6 兼容别名继续可用。没有引入 4xs / 3xs / 2xs 子标尺或 display-1…3 角色：产品无对应消费者，新增完整字号体系超出本轮保留数值的决定。text-4xl / 5xl 仍可使用锁定 Tailwind 的 2.25rem / 3rem，不冒充项目生成标尺；text-2xs 未声明。 |
| fontWeightDefaults | normal / medium / semibold 为 400 / 500 / 600，bold 沿旧兼容映射为 600；不导入 Astryx 的 700。主题可用已有 canonical weight token 显式覆盖，不新增另一套角色配置。 |
| radiusDefaults | 保留现有 rounded-sm…4xl 派生和用户圆角档位；rounded-xs 沿 Tailwind 的 .125rem，none / full 沿原工具类。Astryx inner / element / container / page / chat 是另一套 1/2/3/7 倍公式，没有导入或把现有后缀偷换为这些值。原生 rowRadius 只同步可表达的显式基准。 |
| durationDefaults / easeDefaults | fast / normal / panel / pulse 及所有现有曲线、reduced 值保持。未建立无消费者的 fast/medium/slow min/max 九档。主题 motion.scale 缩放当前四项；单项与曲线可经 canonical tokens 显式覆盖。 |
| transition bridge | 四个 transition-* 使用当前 Tailwind 内建属性集合：colors 保留 outline / gradient，transform 保留独立 translate / scale / rotate。它们读取已有 motion 时长／标准曲线；ease-out 保留原 Tailwind 曲线，不改为 Astryx 的 ease-standard。上游旧 transition-property 命名不为当前编译器重复声明。 |
| size / border / focus / shadow | 已有真实组件消费及独立覆盖回归；尺寸数值用原密度，几何与颜色职责分离。选区、图标、触摸命中框及装饰性的 1px 偏移不当作普通边框替换。 |
| data / syntax | 全部 56 / 19 项接口已提供真实默认值、独立导入与验证；当前没有图表业务或 tokenizer，不为对齐新增产品功能。旧 chart-* 继续 reserved。 |
| components / icons / indicators | Astryx 组件变体、图标替换及 indicator registry 依赖它自己的运行时。MemoCard 保留 Base UI、组件 variants、Lucide / SF Symbols 与 CSS 局部覆盖，不复制第二套组件解释器。工厂明确拒绝这些未知字段。 |
| onDark / onLight / adaptations | Astryx 的局部 MediaTheme 和环境规则工厂未引入；当前反色浮层使用 inverted / on-inverted 配对，响应式与媒体偏好使用已有 Tailwind / CSS。当前主题是文档根单实例，未宣称支持 Astryx 区域主题或复刻其全部 API。 |
| 原生非颜色轴 | NativeSurface 只有 rowRadius 这一可复用标量字段。NativeSidebar 的 @ScaledMetric / 系统字体及 NativeChrome 的平台动画没有 Web 字体／动效字段；沿已有原生契约，不增加协议或改变平台默认行为。Web 内容仍使用 Web token。JS 发布回归与浏览器采样已覆盖，真机视觉未验收。 |

非颜色编译回归覆盖全部现有公共工具类；Chromium / WebKit 在 16 / 20 / 32px 根字号下核对实际间距、大小字体、600 字重、原 monospace 栈、圆角、过渡及独立边框覆盖。保留差异是当前已批准约束下的明确结论；以后要扩展字号、几何标尺、区域主题或原生协议，应另行确定需求和验收范围。

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

Motion 的时长与缓动由 [`features/motion/tokens.css`](../apps/ui/src/features/motion/tokens.css) 唯一维护，参考 [Astryx Motion](https://astryx.atmeta.com/docs/motion) 的 token 使用方式，保留 MemoCard 的全部既有数值。五项时长为 fast 150ms、normal 180ms、panel 200ms、pulse 2s、reduced 0.01ms；六项缓动为 standard、popup、out、linear、rebound、pulse。`out` 保留 CSS `ease-out` 关键字，不等于 Tailwind `ease-out` 的曲线。

`styles.css` 在主题定义后导入动效源。`@theme inline` 将默认过渡时长、默认过渡缓动及 animate-pulse 映射到 motion token，既有 Button、Input、Switch、Tabs 等 transition-* 消费者自动接入。Dialog、Sheet、Sidebar 的显式 duration / ease 工具类直接引用 token；浮层、菜单、提示及遮罩共用 motion-popup 工具类，将时长与缓动映射到 tw-animate 的局部变量，保持它们原有的 transition-duration。快速记录、手势回弹、图片加载的 CSS 简写也直接引用。动画属性、关键帧、方向、次数、手势阈值及 ThemeProvider 临时停用过渡的行为仍由原组件维护；原生系统动效和业务防抖/保存计时不属于 Web 动效 token。

普通控件继续写 `transition-colors` 或 `transition-[...]`。面板时长使用 `duration-(--motion-duration-panel)`；动画专用时长使用 `animation-duration-(--motion-duration-fast)`，避免无意给原本没有过渡的元素增加过渡。CSS 使用 `transition: box-shadow var(--motion-duration-normal) var(--motion-ease-out)`。不要把所有场景套用同一缓动，也不要为即时状态变化新增动画。

Motion 只保留 Docs，原 Reference / Reduced Motion ID 与测试继续隐藏保留。Duration、Easing 和场景表通过 [foundation-motion.data.ts](../apps/ui/stories/foundation-motion.data.ts) 读取生成 token 目录，All tokens 也收录全部十一项定义；不再从组件源码用正则反推时长。减少动态效果表继续读取生产 CSS 并解析 token 引用：全局动画/过渡使用 reduced 0.01ms，平滑滚动为 auto，快速记录与手势回弹的 transition、图片 animation 保留 none。

`pnpm --filter @memocard/ui test:storybook --project motion-tokens` 在 Chromium / WebKit 验证迁移前冻结的计算时长、缓动、进入/退出状态、局部减少动态效果规则及 token 覆盖传递。测试不依赖 token 值生成期望结果；真实关闭、焦点返回及系统偏好切换继续由既有 Sheet / Motion Story 验证。

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

[WebView.swift](../apps/apple/Sources/WebView.swift) 从 `scrollInsets` 写入 `--ios-top` / `--ios-bottom`，单位为 px；[ios-app-chrome.css](../apps/ui/src/components/ios-app-chrome.css) 消费时以 `0px` 回退。安全区随容器和系统状态变化，不设置静态的全局尺寸基准，也不借文档整理改变最低系统要求。

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
- 间距、尺寸与形状：Tailwind 间距标尺、控件密度、内容布局与边框；统一焦点几何由主题 token 拥有。
- 动效与层级：时长、缓动、手势恢复、减少动态效果、portal 与 stacking context。
- 响应式与平台：导航断点、内容容器、安全区、系统字体缩放、材质及浮层定位。

全部 17 项契约的标识、说明、维护源码和消费者见覆盖清单的“组件 平台 与上游所有权”。Storybook 不再展示 `Contract / Guidance` 表格；原来仅承载这些工程信息的 Layering、Responsive 页面撤下。Motion 分类展示实际动效规范与嵌入演示，完整回归保留隐藏 ID。

## 颜色诊断方法与维护

Color 导航仅保留 Docs。Diagnostics 隐藏导航，保留原 ID `foundations-colors--default`、直达路由及全部测试；它只展示当前主题摘要和 22 组配对结果。前景/背景映射、实际用途、源码位置与两项特殊范围维护在 [配对定义](../apps/ui/stories/foundation-colors.example.tsx)，平台消费者见 [Token 消费映射](token-consumption.md)；完整色样仍在 Color Docs 查阅。

[测量函数](../apps/ui/stories/foundation-color-contrast.ts) 将当前 CSS 颜色通过浏览器 Canvas 解析为 sRGB。先将透明背景叠加到样本明确绘制的实色底层，再叠加前景；样本要求 `opacity: 1` 且无背景图。这是平面颜色测量，不是字形抗锯齿或整页截图测量。

- 20 组文字配对沿用 [普通文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) 的 4.5:1 判定；已固定图标沿用 [非文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) 的 3:1 判定。
- `muted-foreground / muted` 作为 Tabs 容器的配对诊断单独标记。实际 Tab 文字由 Trigger 覆写，不能从容器配对推断文字 AA；固定图标也不参与普通文字 AA 统计。
- 页面显示两位小数，判定使用未舍入比值。旧蓝色 primary 约 3.76:1 的问题已通过 blue-600 填充修复，浅深两种模式的白字均以 4.5:1 门槛回归；浅色 muted 容器配对约为 4.46:1，继续单独作为诊断。样本和交互测试通过不代表全部组件或页面符合 AA。
- [颜色场景测试](../apps/ui/stories/foundation-colors.stories.tsx) 继续检查核心与公共 hue 的 108 个颜色映射的非空变量与实际解析色；领域模块另以 75 个映射的编译及渲染回归验证，将重复色板改为用后即清理的隐藏测试夹具。22 组配对（含九组标签色）、原生 palette 各键与测量算法基准继续保留，当前普通文字配对失败清单应为空。真实 Button / Input / Tabs 的控件与交互断言迁到隐藏的 State Regression 场景，沿用默认、Dark、Blue Slate、Dark Teal、Mobile 五种组合，不在 Diagnostics 展示。
- 禁用控件不计入普通文字 AA 结论；键盘焦点场景检查可达性与样式存在，不将其解释为全部焦点几何或颜色对比度已验收。

## 使用与修改

组件优先通过变体表达意图，普通内容使用语义工具类：

```tsx
<Button variant="secondary">保存笔记</Button>

<div className="bg-body text-primary">
  <p className="text-secondary">辅助说明</p>
</div>
```

先修改权威源和登记，再运行 `pnpm tokens:build`。`pnpm tokens:check` 检查完整定义、消费及生成物漂移，`pnpm test:tokens` 检查错误登记等反例。定义与覆盖清单禁止为了缩短展示而裁剪。

`active`、`alias`、`baseline-only`、`reserved` 等状态含义沿用 [定义规范](token-system.md)。Storybook 表格不再提供名称展开；状态、别名表达式、原始声明与来源统一在完整覆盖清单中查阅；未使用定义继续登记，不将目录展示视为生产接入。实际组件状态、对比度和原生设备行为仍需对应验收，详见 [验证记录](validation.md)。
