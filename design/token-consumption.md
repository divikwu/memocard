# Token 消费映射

本表登记维护来源、真实消费与有意保留的平台边界。登记完整不代表每个生成常量都被每个平台使用，也不等于所有组件状态已验收。数字继续只在权威来源修改；本表不复制数值。

下列人工表解释语义及平台边界；完整逐文件索引由 [生成覆盖清单](token-coverage.generated.md#生产源码消费索引) 从生产依赖图、可达 CSS、工具类和样式类采集，包含动态标签/标注/配色、Mermaid、局部危险动作覆盖与原生消费。模板和样式类为可能依赖集合，不等同于全部运行分支的执行记录。

## 可移植尺寸

权威来源为 [sidebar.tokens.json](tokens/sidebar.tokens.json)，生成 [CSS](../apps/ui/src/generated/design-tokens.css)、[TS](../apps/ui/src/generated/design-tokens.ts)、[Swift](../apps/apple/Sources/DesignTokens.generated.swift) 与 [数值对照表](TOKENS.generated.md)。

下表的 Web 消费入口为 [styles.css](../apps/ui/src/styles.css)、[app-sidebar.css](../apps/ui/src/components/app-sidebar.css)、[app-sidebar.tsx](../apps/ui/src/components/app-sidebar.tsx)；原生尺寸消费入口为 [NativeSidebar.swift](../apps/apple/Sources/NativeSidebar.swift)。运行时圆角由 [ios-app-chrome.tsx](../apps/ui/src/components/ios-app-chrome.tsx) 的 `radiusValues[radius]` 经现有 `rowRadius` 协议传递。

| Token | 状态 | Web 消费 | iOS 消费 |
| --- | --- | --- | --- |
| `spacing.xs` | alias | `sidebar.rowGap` 的别名输入 | 同一别名解析后生成行间距 |
| `spacing.sm` | alias | `sidebar.contentGap`、`sidebar.horizontalPadding` 的别名输入 | 同一别名解析后生成图文间距和边距 |
| `spacing.md` | baseline-only | 仅 Foundations 展示；无当前生产消费者 | 无当前生产消费者 |
| `spacing.lg` | baseline-only | 仅 Foundations 展示；无当前生产消费者 | 无当前生产消费者 |
| `spacing.xl` | alias | 不单独输出 Web spacing 变量 | `sidebar.indent` 的别名输入 |
| `spacing.xxl` | baseline-only | 仅 Foundations 展示；无当前生产消费者 | 无当前生产消费者 |
| `radius.none` | active | `data-radius="none"` → `--radius`，`radiusValues` | 经 `rowRadius` 接收该选项 |
| `radius.xs` | active | `data-radius="xs"` → `--radius`，`radiusValues` | 经 `rowRadius` 接收该选项 |
| `radius.sm` | active | `data-radius="sm"` → `--radius`，`radiusValues` | 经 `rowRadius` 接收该选项 |
| `radius.md` | active | `data-radius="md"` → `--radius`，`radiusValues` | 经 `rowRadius` 接收该选项 |
| `radius.lg` | active | 默认 `--radius`、`data-radius="lg"`，`radiusValues` | 经 `rowRadius` 接收；`DesignRadius.lg` 同时用作缺省和 Preview 基准 |
| `radius.xl` | active | `data-radius="xl"` → `--radius`，`radiusValues` | 经 `rowRadius` 接收该选项 |
| `radius.2xl` | active | `data-radius="2xl"` → `--radius`，`radiusValues` | 经 `rowRadius` 接收该选项 |
| `sidebar.desktopRowHeight` | active | styles.css 的 `--sidebar-desktop-row-height`，默认 32px；与当前行盒及内边距取最大值 | Web 专用；生成的 Swift 常量无直接消费者 |
| `sidebar.mobileRowMinHeight` | active | app-sidebar.css 的 `--sidebar-mobile-row-min-height`，最小 48px；文字放大时允许增长 | `SidebarTokens.mobileRowMinHeight`，行的最小高度 |
| `sidebar.iconSize` | active | styles.css / app-sidebar.css 的 `--sidebar-icon-size` | `SidebarTokens.iconSize`，随 Dynamic Type 缩放 |
| `sidebar.contentGap` | active | styles.css / app-sidebar.css 的 `--sidebar-content-gap` | `SidebarTokens.contentGap` |
| `sidebar.rowGap` | active | styles.css 的 `--sidebar-row-gap` | `SidebarTokens.rowGap` |
| `sidebar.indent` | active | 不生成 Web 变量；Web 保留 border/padding 组合 | `SidebarTokens.indent` |
| `sidebar.logoSize` | active | app-sidebar.tsx 的 `--sidebar-logo-size` | Web 专用；原生使用 `sidebar.nativeLogoSize` |
| `sidebar.nativeLogoSize` | active | 不生成 Web 变量；Web 保留 `sidebar.logoSize` | `SidebarTokens.nativeLogoSize`，保留原生平台基准 |
| `sidebar.mobileFontSize` | active | app-sidebar.css 的 `--sidebar-mobile-font-size` | `SidebarTokens.mobileFontSize`，系统 body 字体缩放 |
| `sidebar.desktopFontSize` | active | styles.css 的 `--sidebar-desktop-font-size` | Web 专用；生成的 Swift 常量无直接消费者 |
| `sidebar.brandFontSize` | active | 不生成 Web 变量；Web 保留既有品牌字号 | `SidebarTokens.brandFontSize`，系统 subheadline 字体缩放 |
| `sidebar.captionFontSize` | active | 不生成 Web 变量 | `SidebarTokens.captionFontSize`，系统 caption 字体缩放 |
| `sidebar.toggleVisualSize` | active | app-sidebar.css 的 `--sidebar-toggle-visual-size` | `SidebarTokens.toggleVisualSize`；与命中框分离 |
| `sidebar.touchTargetSize` | active | app-sidebar.css 的 `--sidebar-touch-target-size` | `SidebarTokens.touchTargetSize`；自定义控件策略 |
| `sidebar.horizontalPadding` | active | styles.css / app-sidebar.css 的 `--sidebar-horizontal-padding` | `SidebarTokens.horizontalPadding` |

`spacingValues`、`sidebarTokens` 的 TS 对象供开发展示；生产 Web 的尺寸主要消费生成 CSS。Swift 圆角枚举除 `lg` 外暂无直接引用，其他选项走数值 bridge；不能把生成常量数当作已接入组件数。`baseline-only` 的三个间距仅登记现状，新增消费者前重新评估其复用意义。

Logo 保留各平台已有尺寸：Web / H5 / macOS 使用 `sidebar.logoSize`，iOS 使用 `sidebar.nativeLogoSize`，不把 Web 视觉框作为原生尺寸。

圆角选项 `radius.sm` 与 Tailwind 派生角色 `--radius-sm` 含义不同：前者是用户选择的基准，后者在 [主题 token](../apps/ui/src/features/theme/tokens.css) 中从当前 `--radius` 派生。它们不是两处独立维护的相同数值。

## CSS 语义角色的当前消费

角色名对应 [主题 token](../apps/ui/src/features/theme/tokens.css) 中 `@theme` 的工具类映射；表内只列本项目维护的语义，不把 Tailwind 上游色阶登记为新增产品 token。完整类型、主题轴与覆盖清单见 [token 定义规范](token-system.md) 和 [生成清单](token-coverage.generated.md)。

| 角色族 | 当前生产消费 | 原生边界 |
| --- | --- | --- |
| `background / foreground`、`card / card-foreground` | 页面底色与正文；[Card](../apps/ui/src/components/ui/card.tsx) 和笔记集合 | palette 提供 background/foreground；原生容器与材质不照搬 Web Card |
| `popover / popover-foreground` | [Popover](../apps/ui/src/components/ui/popover.tsx)、[Menu](../apps/ui/src/components/ui/dropdown-menu.tsx)、[Select](../apps/ui/src/components/ui/select.tsx) 浮层 | 系统菜单/弹窗由平台拥有，不复制 Web 浮层内部颜色与阴影 |
| `primary / primary-foreground`、`secondary / secondary-foreground`、`destructive` | [Button](../apps/ui/src/components/ui/button.tsx) 的动作与危险变体、Switch、危险菜单项 | 自定义内容接收所需 palette；系统危险操作使用系统语义 |
| `muted / muted-foreground`、`accent / accent-foreground`、`hover` | 辅助文字、[Tabs](../apps/ui/src/components/ui/tabs.tsx) 背景、[搜索结果](../apps/ui/src/components/note-search-dialog.tsx)、菜单焦点/悬停；hover 映射 `--hover-bg` | 原生仅接收已有 palette 键；不是完整 Web 状态机复制 |
| `accent-text` | [NotePinButton](../apps/ui/src/components/note-pin-button.tsx) 的已固定状态 | 无单独原生同名键；按现有原生组件语义 |
| `border / input / ring` | 全局边线与 outline、[Input](../apps/ui/src/components/ui/input.tsx)、Textarea、Select 的边框/焦点及 Button 焦点 | 自定义内容仅接收所需 border；系统输入/焦点沿平台行为 |
| `sidebar / sidebar-foreground / sidebar-accent / sidebar-accent-foreground / sidebar-border / sidebar-ring` | [Sidebar](../apps/ui/src/components/ui/sidebar.tsx) 容器、分组、行、展开控件及焦点 | `IOS_PALETTE_KEYS` 中的 sidebar 子集供自定义侧栏，仍保留原生命中区/字体缩放 |
| `tag-<color>-bg / tag-<color>-fg` | [TagPill](../apps/ui/src/TagPill.tsx)、标签颜色菜单、编辑器标签；选项来自 tagColors | 默认/八种配色成对解析到 RGBA |
| `chart-1…chart-5`、`emphasis / emphasis-foreground`、`sidebar-primary / sidebar-primary-foreground` | **保留定义，无当前生产消费者**；Foundations 展示不算生产接入 | 不在当前 `IOS_PALETTE_KEYS` 中 |

## 动态语义与平台所有权

| 类别 | 唯一维护来源 | 消费与边界 | 开发预览 |
| --- | --- | --- | --- |
| 界面语义颜色 | [theme/tokens.css](../apps/ui/src/features/theme/tokens.css) 的语义变量与 `@theme` 映射；[styles.css](../apps/ui/src/styles.css) 保留加载入口与业务样式 | Web 使用语义工具类；[readIOSPalette](../apps/ui/src/lib/ios-palette.ts) 只解析原生实际需要的键，经 bridge 传原生，不另建 Swift 主题解析器 | [foundations/colors](../apps/ui/stories/foundation-colors.stories.tsx) 的代表浅/深色对诊断与真实 Button/Input/Tabs 状态 |
| 标签前景/背景 | [tag-colors.tokens.css](../apps/ui/src/tag-colors.tokens.css)、[tagColors](../apps/ui/src/tag-colors.ts) 的选项；[tag-colors.css](../apps/ui/src/tag-colors.css) 导入并消费 | Web 标签与颜色菜单；原生消费同一组已解析 RGBA。默认灰色是内部别名，不增加新的用户选项 | 同一颜色故事的标签色对 |
| 外观选项与默认值 | [preferences.ts](../apps/ui/src/features/theme/preferences.ts)、[ThemeProvider](../apps/ui/src/features/theme/ThemeProvider.tsx) | 主题/强调色/中性色/圆角/界面字体的设置和持久化；不是可移植尺寸定义 | foundations/colors 的 LivePalette；各故事 toolbar |
| 字体资源与回退 | [font-options.ts](../apps/ui/src/lib/font-options.ts)、[font-loader.ts](../apps/ui/src/features/theme/font-loader.ts)；[笔记默认回退](../apps/ui/src/features/typography/tokens.css) | Web 的界面及笔记字体；原生系统字体不读取 Web 字体文件 | [foundations/typography](../apps/ui/stories/foundation-typography.stories.tsx) 沿用当前默认字体与既有回退，不表示全字体字形验收 |
| 笔记字号/行高/阅读宽度/段距 | [排版偏好](../apps/ui/src/features/typography/preferences.ts)、[TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx)、[typeset.css](../apps/ui/src/typeset.css) | 笔记内容的既有排版变量，保留用户设置；不强行并入侧栏 token | 同一排版故事，生产 options 的四轴边界、真实 Provider 调整/恢复、H5 阅读宽度与溢出检查 |
| 基础排版与通用文字角色 | [typography/scale.ts](../apps/ui/src/features/typography/scale.ts) → 生成 CSS；七档 rem 字号、三档字重、三种行高策略 | [Typeset](../apps/ui/src/typeset.css)、[styles.css](../apps/ui/src/styles.css)、[搜索](../apps/ui/src/components/note-search-dialog.css)、[Button](../apps/ui/src/components/ui/button.tsx) 及实际界面字号声明 | 8 个共享角色；Button / Tabs / 菜单 / Select / 输入组共享角色，字重由 manifest 生成；保留 17 个组件兼容别名但不再消费；注册、级联、缩放和交互测试，见 [Typography 系统](typography.md) |
| 浮层阴影 | [theme/tokens.css](../apps/ui/src/features/theme/tokens.css) 的 `--overlay-shadow` | Web 的 Popover/Menu 等；原生菜单与材质由系统管理 | [foundations/elevation](../apps/ui/stories/foundation-effects.stories.tsx) |
| 项目表面与控件阴影 | [theme/tokens.css](../apps/ui/src/features/theme/tokens.css) 与 [theme/capture.tokens.css](../apps/ui/src/features/theme/capture.tokens.css) 的四个项目角色，逐项见下表 | 原有值从组件迁入定义，保留浅深色与状态选择器；不替换成相近的上游档位 | Elevation / All tokens 读取目录；隐藏 [project shadows](../apps/ui/stories/project-shadows.stories.tsx) 核对原值及真实变量消费，原 QuickCapture / effects 交互测试保留 |
| 动效与层级 | [全局 Reduce Motion](../apps/ui/src/styles.css)、[sidebar.tsx](../apps/ui/src/components/ui/sidebar.tsx)、[sheet.tsx](../apps/ui/src/components/ui/sheet.tsx) 及各组件 CSS | 时长、z-index 与手势仍由已有组件拥有，不新增全局数字。iOS 系统与 UIKit 容器继续管理原生动效 | effects 的浅/深色阴影与焦点；真实浏览器媒体偏好切换下的生产 Sheet 时长、关闭及焦点恢复 |
| 图标 | [Lucide 导出映射](../scripts/generate-sidebar-icons.mjs) 与锁定依赖 | 自定义侧栏用同源 SVG；系统工具栏、菜单保留 SF Symbols | effects 直接读取已生成的原生 SVG |
| safe area / 系统控件度量 | [NativeChrome.swift](../apps/apple/Sources/NativeChrome.swift)、[WebView.swift](../apps/apple/Sources/WebView.swift) 与平台 API | 系统菜单、确认、文件选择、键盘、材质与安全区不复制成 Web token | 原生 App；适用场景见[组件清单](component-inventory.md) |
| 原生安全区输出 | [WebView.swift](../apps/apple/Sources/WebView.swift) 的 scrollInsets | 写入 `--ios-top` / `--ios-bottom`（px）；[app-sidebar.css](../apps/ui/src/components/app-sidebar.css) 的原生导航容器以 0px 回退消费 | 原生 App；登记输出不替代设备安全区验收 |
| 浮层定位输出 | Base UI Positioner，依赖版本见 [package.json](../apps/ui/package.json) | `--available-height` / `--available-width` / `--anchor-width` / `--transform-origin` 在浮层局部消费，不能建立固定的全局默认值 | Popover、Menu、Select、Tooltip 与编辑器浮层 |
| 标注背景、文字与菜单色样 | [import-layout.tokens.css](../apps/ui/src/import-layout.tokens.css) 的 background / text / swatch 三组，各九色 | [import-layout.css](../apps/ui/src/import-layout.css) 消费背景与文字，标题继承文字；[CalloutColorsMenu](../apps/ui/src/CalloutColorsMenu.tsx) 消费背景与固定色相样本。默认文字与样本沿用 foreground，默认背景透明；保留菜单与实际文字既有色值差异 | 隐藏 [callout colors](../apps/ui/stories/callout-colors.stories.tsx) 场景覆盖浅深色原值、实际 token 覆盖、菜单选择与重置；RichMarkdownEditor 回归覆盖撤销、序列化与重开 |
| 内容局部颜色与布局 | [import-layout.css](../apps/ui/src/import-layout.css)、[rich-editor.css](../apps/ui/src/rich-editor.css)、[block-controls.css](../apps/ui/src/block-controls.css)、[MermaidPreview](../apps/ui/src/MermaidPreview.tsx) 等，完整文件见 registry | 选区、拖拽指示与内容布局仍由组件拥有；保留既有硬编码与主题派生，未将其误报为已迁入全局 token | 既有正文、富文本编辑器、快速记录和内容预览回归 |

颜色诊断区分样本用途：普通文字前景/背景配对使用 4.5:1，`accent-text` 的当前生产消费者为已固定状态图标，使用非文本 3:1。Tabs 容器的继承色不等同于实际 Tab 文字颜色，必须检查真实 Trigger 的选中/未选中渲染；不能用容器比值认定文字缺陷。透明背景先与实际样本底色合成，判定使用未舍入比值；平面色样测量不是字形截图或整页无障碍审计。代表主题下的既有未达标项见[验证记录](validation.md)，不在故事中修改生产颜色或降低阈值。

## 项目阴影角色

共享表面与轻量控件的权威来源为 [theme/tokens.css](../apps/ui/src/features/theme/tokens.css)，快速记录专用的两个模式角色由 [theme/capture.tokens.css](../apps/ui/src/features/theme/capture.tokens.css) 随组件加载；每项仅维护一份定义，保留原有模糊、偏移、扩散和颜色。

| Token | 消费入口 | 模式与边界 |
| --- | --- | --- |
| `--surface-shadow` | [QuickCapture](../apps/ui/src/components/quick-capture.tsx)、[LoadingCapture](../apps/ui/src/components/loading-states.tsx)、[collectionClasses](../apps/ui/src/components/note-collection-layout.ts) 的卡片布局（包含加载卡片） | 浅深色同值；使用 `shadow-(--surface-shadow)`，列表布局仍为 shadow-none |
| `--surface-focus-shadow` | [quick-capture.css](../apps/ui/src/quick-capture.css) 的 `.quick-capture-group:focus-within` | 浅深色分别覆盖；桌面输入和移动 Sheet 共用，原聚焦条件不变 |
| `--control-shadow` | [quick-capture.css](../apps/ui/src/quick-capture.css) 的继续页面按钮；[app-sidebar.css](../apps/ui/src/components/app-sidebar.css) 的移动端导航和 Sheet 关闭按钮 | 浅深色同值，保留原移动断点、描边与焦点反馈 |
| `--floating-control-shadow` | [quick-capture.css](../apps/ui/src/quick-capture.css) 的 mobile-record-bar 搜索与快速记录入口 | 浅深色分别覆盖；描边、背景与 focus-visible 规则不变 |

上游 `shadow-lg` 等消费者和已使用 `--overlay-shadow` 的浮层继续复用现有定义；混合状态的 `inset 0 -2px var(--muted-foreground)` 是按钮状态下划线，仍由 rich-format-tools.css 拥有。

## 变更与验收

修改 token 后更新生成物、此表及对应故事；迁移动态语义时同时移除旧定义，保持每类值的唯一来源。`check:design-inventory` 检查尺寸条目无遗漏/重复/未知项、表内文件链接有效，配合现有生成物漂移检查。它不证明所有运行路径和视觉状态已覆盖；实际交互和跨端边界仍按[组件维护表](component-inventory.md)验收。
