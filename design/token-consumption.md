# Token 消费映射

本表登记维护来源、真实消费与有意保留的平台边界。登记完整不代表每个生成常量都被每个平台使用，也不等于所有组件状态已验收。数字继续只在权威来源修改；本表不复制数值。

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
| `sidebar.desktopRowHeight` | active | styles.css 的 `--sidebar-desktop-row-height` | Web 专用；生成的 Swift 常量无直接消费者 |
| `sidebar.mobileRowMinHeight` | active | app-sidebar.css 的 `--sidebar-mobile-row-min-height` | `SidebarTokens.mobileRowMinHeight`，行的最小高度 |
| `sidebar.iconSize` | active | styles.css / app-sidebar.css 的 `--sidebar-icon-size` | `SidebarTokens.iconSize`，随 Dynamic Type 缩放 |
| `sidebar.contentGap` | active | styles.css / app-sidebar.css 的 `--sidebar-content-gap` | `SidebarTokens.contentGap` |
| `sidebar.rowGap` | active | styles.css 的 `--sidebar-row-gap` | `SidebarTokens.rowGap` |
| `sidebar.indent` | active | 不生成 Web 变量；Web 保留 border/padding 组合 | `SidebarTokens.indent` |
| `sidebar.logoSize` | active | app-sidebar.tsx 的 `--sidebar-logo-size` | `SidebarTokens.logoSize` |
| `sidebar.mobileFontSize` | active | app-sidebar.css 的 `--sidebar-mobile-font-size` | `SidebarTokens.mobileFontSize`，系统 body 字体缩放 |
| `sidebar.desktopFontSize` | active | styles.css 的 `--sidebar-desktop-font-size` | Web 专用；生成的 Swift 常量无直接消费者 |
| `sidebar.brandFontSize` | active | 不生成 Web 变量；Web 保留既有品牌字号 | `SidebarTokens.brandFontSize`，系统 subheadline 字体缩放 |
| `sidebar.captionFontSize` | active | 不生成 Web 变量 | `SidebarTokens.captionFontSize`，系统 caption 字体缩放 |
| `sidebar.toggleVisualSize` | active | app-sidebar.css 的 `--sidebar-toggle-visual-size` | `SidebarTokens.toggleVisualSize`；与命中框分离 |
| `sidebar.touchTargetSize` | active | app-sidebar.css 的 `--sidebar-touch-target-size` | `SidebarTokens.touchTargetSize`；自定义控件策略 |
| `sidebar.horizontalPadding` | active | styles.css / app-sidebar.css 的 `--sidebar-horizontal-padding` | `SidebarTokens.horizontalPadding` |

`spacingValues`、`sidebarTokens` 的 TS 对象供开发展示；生产 Web 的尺寸主要消费生成 CSS。Swift 圆角枚举除 `lg` 外暂无直接引用，其他选项走数值 bridge；不能把生成常量数当作已接入组件数。`baseline-only` 的三个间距仅登记现状，新增消费者前重新评估其复用意义。

圆角选项 `radius.sm` 与 Tailwind 派生角色 `--radius-sm` 含义不同：前者是用户选择的基准，后者在 [styles.css](../apps/ui/src/styles.css) 中从当前 `--radius` 派生。它们不是两处独立维护的相同数值。

## CSS 语义角色的当前消费

角色名对应 `@theme` 的工具类映射；表内只列本项目维护的语义，不把 Tailwind 上游色阶登记为新增产品 token。

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
| 界面语义颜色 | [styles.css](../apps/ui/src/styles.css) 的语义变量与 `@theme` 映射 | Web 使用语义工具类；[readIOSPalette](../apps/ui/src/lib/ios-palette.ts) 只解析原生实际需要的键，经 bridge 传原生，不另建 Swift 主题解析器 | [foundations/colors](../apps/ui/stories/foundation-colors.stories.tsx)，浅/深与 toolbar 强调色 |
| 标签前景/背景 | [tag-colors.css](../apps/ui/src/tag-colors.css)、[tagColors](../apps/ui/src/tag-colors.ts) 的选项 | Web 标签与颜色菜单；原生消费同一组已解析 RGBA。默认灰色是内部别名，不增加新的用户选项 | 同一颜色故事的标签色对 |
| 外观选项与默认值 | [preferences.ts](../apps/ui/src/features/theme/preferences.ts)、[ThemeProvider](../apps/ui/src/features/theme/ThemeProvider.tsx) | 主题/强调色/中性色/圆角/界面字体的设置和持久化；不是可移植尺寸定义 | foundations/tokens 的 LivePalette；各故事 toolbar |
| 字体资源与回退 | [font-options.ts](../apps/ui/src/lib/font-options.ts)、[font-loader.ts](../apps/ui/src/features/theme/font-loader.ts) | Web 的界面及笔记字体；原生系统字体不读取 Web 字体文件 | [foundations/typography](../apps/ui/stories/foundation-typography.stories.tsx) |
| 笔记字号/行高/阅读宽度/段距 | [排版偏好](../apps/ui/src/features/typography/preferences.ts)、[TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx)、[typeset.css](../apps/ui/src/typeset.css) | 笔记内容的既有排版变量，保留用户设置；不强行并入侧栏 token | 同一排版故事，真实 Provider 的字号切换与恢复 |
| 浮层阴影 | [styles.css](../apps/ui/src/styles.css) 的 `--overlay-shadow` | Web 的 Popover/Menu 等；原生菜单与材质由系统管理 | [foundations/effects](../apps/ui/stories/foundation-effects.stories.tsx) |
| 动效与层级 | [全局 Reduce Motion](../apps/ui/src/styles.css)、[sidebar.tsx](../apps/ui/src/components/ui/sidebar.tsx)、[sheet.tsx](../apps/ui/src/components/ui/sheet.tsx) 及各组件 CSS | 时长、z-index 与手势仍由已有组件拥有，不新增全局数字。iOS 系统与 UIKit 容器继续管理原生动效 | effects 的规则说明；独立组件故事验证关闭与焦点 |
| 图标 | [Lucide 导出映射](../scripts/generate-sidebar-icons.mjs) 与锁定依赖 | 自定义侧栏用同源 SVG；系统工具栏、菜单保留 SF Symbols | effects 直接读取已生成的原生 SVG |
| safe area / 系统控件度量 | [NativeChrome.swift](../apps/apple/Sources/NativeChrome.swift)、[WebView.swift](../apps/apple/Sources/WebView.swift) 与平台 API | 系统菜单、确认、文件选择、键盘、材质与安全区不复制成 Web token | 原生 App；适用场景见[组件清单](component-inventory.md) |

## 变更与验收

修改 token 后更新生成物、此表及对应故事；迁移动态语义时同时移除旧定义，保持每类值的唯一来源。`check:design-inventory` 检查尺寸条目无遗漏/重复/未知项、表内文件链接有效，配合现有生成物漂移检查。它不证明所有运行路径和视觉状态已覆盖；实际交互和跨端边界仍按[组件维护表](component-inventory.md)验收。
