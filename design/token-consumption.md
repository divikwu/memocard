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

五档基础尺度 `--shadow-scale-0` 至 `--shadow-scale-4` 统一在 [theme.css](../apps/ui/ui/theme.css) 拥有浅深色定义。0 为六层透明投影，1 为两层投影与一层 1px 外缘，2–4 为五层投影与一层 1px 外缘（包含透明占位层）。浅深色共享几何结构、分别定义各层透明度；完整参数由主题 CSS 拥有。组件通过语义角色选择高度；结构边框、内侧高光、键盘焦点与状态内环分别维护。

| 基础尺度 | 语义角色 | 当前组件职责 |
| --- | --- | --- |
| `0` | `--shadow-flat` / `shadow-flat` | 笔记集合卡片默认平面；保留透明过渡层 |
| `1` + 控件高光 | `--shadow-control` / `shadow-control` | Switch / Slider 滑块、小型圆形控件；组合独立的 `--surface-highlight-control` |
| `2` | `--shadow-low` / `shadow-low` | 轻浮起表面、PC 快速记录默认面板 |
| `3` | `--shadow-med` / `shadow-med` | 通用 Card 表面 |
| `3`（经 med） | `--shadow-input-focus` / `shadow-input-focus` | PC 快速记录与输入聚焦表面 |
| `4` | `--shadow-high` / `shadow-high` | 菜单、Popover、Dialog 等浮层；显式搭配 surface-floating 保留边框和独立轮廓 |
| `2` | `--shadow-floating` / `shadow-floating` | 富文本浮动工具条、Mermaid 切换工具条 |
| `3` | `--shadow-document` / `shadow-document` | 回收站笔记预览等独立文档表面；全屏编辑区保持平面 |
| `2`（经 low） | `--shadow-card-hover` / `shadow-card-hover` | 笔记卡片与 Preview 入口的鼠标悬停反馈 |

组件只消费上表语义角色；基础尺度由主题与标尺示例引用。工具类仅开放同名语义角色；旧尺寸别名已移除，并通过 shadow 命名空间重置阻止 Tailwind 默认值回落。`shadow-none` 清除阴影，`shadow-flat` 保留透明过渡配方。inset 状态变量按 `reserved` 单独登记，不导出 `shadow-inset-*` 工具类，不代表生产组件已消费，也不提供与投影组合的公开接口。

z-index 管理前后顺序，阴影等级表达感知高度；嵌套菜单与弹层可复用同一档。嵌入式移动面板、表格与图片工具条保持平面，反色 Tooltip 依靠实心底色和箭头区分内容，不自动增加投影。

`surface-floating` 承载透明布局边框和独立内侧高光，通过组合槽和 `shadow-high` 搭配；装饰外缘由投影提供。显式使用 `shadow-none` 或 `shadow-flat` 时恢复普通边框。投影颜色由主题 `--color-shadow` 管理，不提供 shadow-颜色 工具类契约。

`--surface-edge-floating` 只补充深色 white / 4% 内侧高光，浅色为透明；`--color-border-floating` 在常规浅深色下均为透明，保留原 1px 布局尺寸，避免与投影内置外缘叠加。平面笔记卡片、移动端无投影输入面板保留弱边框，交互状态和键盘焦点独立。原生 `NativeElevation` 由 SwiftUI / UIKit 消费，浅色采用原生深色基准的 75%，保留快速记录向下和抽屉向左、随进度变化的参数。

键盘焦点使用独立的 `--focus-outline-*`：2px 实线、向外偏移 2px，浅色为不透明 `neutral-600`，深色为不透明 `neutral-400`。强制颜色模式的焦点与浮层布局边框改用系统前景色 `CanvasText`，与 `Canvas` 背景配对，使浏览器清除投影后仍有边界。焦点与投影分别验证。

控件白色 1px 内侧高光由 `--surface-highlight-control` 单独维护，浅色 / 深色透明度为 88% / 4%，不属于外投影高度。笔记卡片 hover 使用 `--shadow-card-hover → low → scale-2`，输入聚焦使用 `--shadow-input-focus → med → scale-3`；状态角色复用统一尺度，缩放独立维护。完整浅深色标尺与可交互组件示例见 [Elevation Storybook](../apps/ui/ui/stories/elevation.stories.tsx)。该示例仅使用内存与静态内容，不接入真实笔记库；Web CSS 接入不代表原生系统表面或全部设备已验收。

## 当前语义角色与运行时输出

| 来源 | 当前消费 | 平台边界 |
| --- | --- | --- |
| [theme.css](../apps/ui/ui/theme.css) | 页面、控件、文本、状态、圆角、尺寸、动效及 Tailwind 语义别名 | 图表和完整 syntax 色定义保留不代表当前业务已使用；brand 未配置 |
| [web-palette.css](../apps/ui/ui/web/web-palette.css) | 8 种强调色、2 种中性色与明暗模式覆盖 | 同一 role 的明确覆盖，不维护第二份组件主题 |
| [preview-mode.tsx](../apps/ui/ui/preview-mode.tsx)、[外观选择映射](../apps/ui/ui/preview-appearance.css) | 当前产品与 Storybook 共用 UI 字体、圆角和字体加载反馈 | 名称为历史目录命名；产品偏好和 Storybook fixture 仍隔离 |
| [TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx)、[web-typography.css](../apps/ui/ui/web/web-typography.css) | 字号、行宽、行高与段距；字体跟随 UI 外观 | 只改变笔记阅读/编辑内容 |
| [note-properties.css](../apps/ui/ui/business/note-properties.css)、[TagColorStyles](../apps/ui/src/TagColorStyles.core.tsx) | 按 vault 标签颜色、正文标签和属性标签 | 保留现有本机偏好和颜色标识 |
| [ios-palette.ts](../apps/ui/src/lib/ios-palette.ts)、[ios-theme.ts](../apps/ui/src/lib/ios-theme.ts) | 从当前语义 role 解析 RGBA 与实际圆角 | 保留原生 payload 键；系统控件仍由平台负责 |
| [WebView.swift](../apps/apple/Sources/WebView.swift)、[native-chrome.css](../apps/ui/ui/native/native-chrome.css) | `--ios-top` / `--ios-bottom` 安全区输出 | 不用固定 Web 数值取代系统安全区 |

完整定义、类型、所有权和实际生产依赖图消费索引见 [registry.json](tokens/registry.json) 与 [生成覆盖清单](token-coverage.generated.md)。`active` 表示定义/消费职责有效，不表示每个颜色、交互状态、字体组合或设备都通过验收。
