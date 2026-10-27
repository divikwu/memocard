# Token 消费映射

当前产品只有一套 UI。Web、H5、macOS WebView 与 iOS 内嵌正文使用 [当前主题](../apps/ui/ui/theme.css)；iOS 导航和系统表面继续由 SwiftUI / UIKit 负责。登记完整不等于全部状态或真机已验收。

## 可移植尺寸

[sidebar.tokens.json](tokens/sidebar.tokens.json) 仅生成 [Swift](../apps/apple/Sources/DesignTokens.generated.swift) 和 [基准对照表](TOKENS.generated.md)。当前 Web 尺寸直接由 Luma 主题和组件 CSS 拥有，不再生成无消费者的 Web CSS / TypeScript。原生直接消费 [NativeSidebar.swift](../apps/apple/Sources/NativeSidebar.swift) 中的常量；数值相同不代表共享消费。

| Token | 状态 | Web 消费 | iOS 消费 |
| --- | --- | --- | --- |
| `spacing.xs` | alias | 无当前生产消费者；仅保留生成基准 | sidebar.rowGap 的别名输入 |
| `spacing.sm` | alias | 无当前生产消费者；仅保留生成基准 | sidebar.contentGap / horizontalPadding 的别名输入 |
| `spacing.md` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `spacing.lg` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `spacing.xl` | alias | 无当前生产消费者；仅保留生成基准 | sidebar.indent 的别名输入 |
| `spacing.xxl` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `radius.none` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `radius.xs` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `radius.sm` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `radius.md` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `radius.lg` | active | 无当前生产消费者；仅保留生成基准 | DesignRadius.lg 仅作原生侧栏尚无运行时值时的缺省；Debug Preview 消费当前 CSS 采样圆角 |
| `radius.xl` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `radius.2xl` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `sidebar.desktopRowHeight` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `sidebar.mobileRowMinHeight` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.mobileRowMinHeight；原生布局 / Dynamic Type 消费 |
| `sidebar.iconSize` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.iconSize；原生布局 / Dynamic Type 消费 |
| `sidebar.contentGap` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.contentGap；原生布局 / Dynamic Type 消费 |
| `sidebar.rowGap` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.rowGap；原生布局 / Dynamic Type 消费 |
| `sidebar.indent` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.indent；原生布局 / Dynamic Type 消费 |
| `sidebar.logoSize` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `sidebar.nativeLogoSize` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.nativeLogoSize；原生布局 / Dynamic Type 消费 |
| `sidebar.mobileFontSize` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.mobileFontSize；原生布局 / Dynamic Type 消费 |
| `sidebar.desktopFontSize` | baseline-only | 无当前生产消费者；仅保留生成基准 | 无当前生产消费者 |
| `sidebar.brandFontSize` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.brandFontSize；原生布局 / Dynamic Type 消费 |
| `sidebar.captionFontSize` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.captionFontSize；原生布局 / Dynamic Type 消费 |
| `sidebar.toggleVisualSize` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.toggleVisualSize；原生布局 / Dynamic Type 消费 |
| `sidebar.touchTargetSize` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.touchTargetSize；原生布局 / Dynamic Type 消费 |
| `sidebar.horizontalPadding` | active | 无当前生产消费者；仅保留生成基准 | SidebarTokens.horizontalPadding；原生布局 / Dynamic Type 消费 |

原生运行时圆角由 [当前适配器](../apps/ui/ui/native/IOSAppChrome.tsx) 读取真实 `--radius-element`，经既有 `rowRadius` 协议传递；不再用旧 `radiusValues` 选项表代替计算结果。旧设备偏好由 [WebAppearance](../apps/ui/ui/web/WebAppearance.tsx) 读取并保留兼容值。

## 阴影标尺与组件职责

八档基础标尺统一在 [theme.css](../apps/ui/ui/theme.css) 拥有浅色与深色定义，参考 2026-10-27 核对的 Craft Web CSS，浅色黑色外投影透明度为参考值的 75%（降低 25%），深色保留对应参考值，几何参数保持原样；组件通过语义角色消费，外投影不含原始 1px 边缘层。实际 border、内侧高光、键盘焦点与状态内环分别维护。

| 基础标尺 | 语义角色 | 当前组件职责 |
| --- | --- | --- |
| `empty` | `--shadow-scale-empty` | 笔记集合卡片默认平面；保留透明过渡层 |
| `xxs` + `inner` | `--shadow-control` | Switch / Slider 滑块、小型圆形控件；inner 为白色内侧高光 |
| `xs` | `--shadow-low` / `shadow-sm` | 轻浮起表面、PC 快速记录默认面板 |
| `sm` | `--shadow-med` / `shadow-med` | Card 与快速记录聚焦表面；input-focus 映射同一角色 |
| `md` | `--shadow-high` / `surface-floating` | 菜单、Popover、Dialog 等浮层；utility 另组合独立轮廓 |
| `sr` | `--shadow-floating` | 富文本浮动工具条、Mermaid 切换工具条 |
| `doc` | `--shadow-document` | 回收站笔记预览等独立文档表面；全屏编辑区保持平面 |

`--surface-edge-floating` 独立管理浮层轮廓：浅色透明，不改变既有边框；深色为 black / 12% 外缘 + white / 4% 内缘，`--color-border-floating` 同时设为透明，保留原 1px 布局尺寸。原生 `NativeElevation` 由 SwiftUI / UIKit 消费，浅色采用原生深色基准的 75%，保留快速记录向下和抽屉向左、随进度变化的参数。

笔记卡片 hover 独立使用 `--shadow-card-hover`：0 10px 20px，浅色 black / 3%，深色在本项目表面使用 black / 12%。完整浅深色标尺与可交互组件示例见 [Elevation Storybook](../apps/ui/ui/stories/elevation.stories.tsx)。该示例仅使用内存与静态内容，不接入真实笔记库；Web CSS 接入不代表原生系统表面或全部设备已验收。

## 当前语义角色与运行时输出

| 来源 | 当前消费 | 平台边界 |
| --- | --- | --- |
| [theme.css](../apps/ui/ui/theme.css) | 页面、控件、文本、状态、圆角、尺寸、动效及 Tailwind 语义别名 | 图表和完整 syntax 色定义保留不代表当前业务已使用；brand 未配置 |
| [web-palette.css](../apps/ui/ui/web/web-palette.css) | 8 种强调色、2 种中性色与明暗模式覆盖 | 同一 role 的明确覆盖，不维护第二份组件主题 |
| [preview-mode.tsx](../apps/ui/ui/preview-mode.tsx)、[外观选择映射](../apps/ui/ui/preview-appearance.css) | 当前产品与 Storybook 共用 UI 字体、圆角和字体加载反馈 | 名称为历史目录命名；产品偏好和 Storybook fixture 仍隔离 |
| [TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx)、[web-typography.css](../apps/ui/ui/web/web-typography.css) | 正文/标题/等宽字体、字号、行宽、行高与段距 | 只改变笔记阅读/编辑内容 |
| [note-properties.css](../apps/ui/ui/business/note-properties.css)、[TagColorStyles](../apps/ui/src/TagColorStyles.core.tsx) | 按 vault 标签颜色、正文标签和属性标签 | 保留现有本机偏好和颜色标识 |
| [ios-palette.ts](../apps/ui/src/lib/ios-palette.ts)、[ios-theme.ts](../apps/ui/src/lib/ios-theme.ts) | 从当前语义 role 解析 RGBA 与实际圆角 | 保留原生 payload 键；系统控件仍由平台负责 |
| [WebView.swift](../apps/apple/Sources/WebView.swift)、[native-chrome.css](../apps/ui/ui/native/native-chrome.css) | `--ios-top` / `--ios-bottom` 安全区输出 | 不用固定 Web 数值取代系统安全区 |

完整定义、类型、所有权和实际生产依赖图消费索引见 [registry.json](tokens/registry.json) 与 [生成覆盖清单](token-coverage.generated.md)。`active` 表示定义/消费职责有效，不表示每个颜色、交互状态、字体组合或设备都通过验收。
