# MemoCard token 定义规范

现行产品、唯一 Storybook 和状态 Preview 共用 Luma / Base UI 主题。默认浅色、黑白强调色、Neutral、Noto Sans、8px 控件圆角。入口与职责总览见[设计维护入口](README.md)，工程消费见[Token 消费映射](token-consumption.md)。

## 权威来源

| 内容 | 当前来源 | 维护边界 |
| --- | --- | --- |
| 语义颜色、字体标尺、尺寸、圆角、动效、Tailwind 别名 | [theme.css](../apps/ui/ui/theme.css) | 产品和 Storybook 使用同一份定义；`@theme reference inline` 提供工具类映射 |
| 强调色与中性色覆盖 | [web-palette.css](../apps/ui/ui/web/web-palette.css)、[WebAppearance](../apps/ui/ui/web/WebAppearance.tsx) | 明暗/系统、8 种强调色、2 种中性色；显式覆盖同名语义角色 |
| UI 字体与圆角选择 | [preview-appearance](../apps/ui/ui/preview-appearance.ts)、[preview-mode](../apps/ui/ui/preview-mode.tsx)、[字体资源](../apps/ui/ui/preview-fonts.ts) | 名称源于早期预览目录，现由产品和示例共同消费 |
| 笔记内容风格 | [preferences.ts](../apps/ui/src/features/typography/preferences.ts)、[TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx)、[web-typography.css](../apps/ui/ui/web/web-typography.css) | 正文、标题、等宽字体及阅读节奏；不改变导航工具栏 |
| 标签及 Callout | [note-properties.css](../apps/ui/ui/business/note-properties.css)、[note-content.css](../apps/ui/ui/business/note-content.css) | 复用主题色系，局部角色和保存标识由业务组件拥有 |
| 原生可移植尺寸 | [sidebar.tokens.json](tokens/sidebar.tokens.json) | 只生成 Swift 常量和[基准对照表](TOKENS.generated.md)，不生成 Web CSS / TS |
| 原生颜色、圆角、安全区 | [ios-palette](../apps/ui/src/lib/ios-palette.ts)、[ios-theme](../apps/ui/src/lib/ios-theme.ts)、[原生适配器](../apps/ui/ui/native/IOSAppChrome.tsx)、[WebView](../apps/apple/Sources/WebView.swift) | 浏览器解析颜色和圆角后传递；SwiftUI / UIKit 拥有系统表面和安全区 |

## 定义层级与覆盖类别

基础标尺描述色阶、字号、间距和尺寸。语义角色描述正文、表面、操作和反馈。组件局部变量只在实际需要独立调整时提取。适配层连接 Tailwind、偏好或原生协议，不维护另一套默认主题。

[registry.json](tokens/registry.json) 登记 color、typography、spacing、sizing、shape、effects、layering、motion、responsive 九类契约，包含类型、状态、所有权、覆盖来源、运行时输出和上游变量。定义与消费索引见[生成覆盖清单](token-coverage.generated.md)。有定义或登记不等于所有状态已被生产消费或完成设备验收。

`active` 表示有生产消费职责；`alias` 表示引用或工具类映射；`baseline-only` 表示仅作基准；`reserved` 表示保留但无生产消费。组件、平台与上游拥有的变量分别登记，不把局部实现自动提升为全局 token。

## 命名与状态

| 用途 | 当前 CSS 角色 | 工具类示例 |
| --- | --- | --- |
| 页面与内容表面 | `--color-background-body`、`--color-background-surface` | `bg-body`、`bg-surface` |
| 主次文字与控件辅助文字 | `--color-text-primary`、`--color-text-secondary`、`--color-text-control-secondary` | `text-primary`、`text-secondary`、`placeholder:text-control-secondary` |
| 强调操作 | `--color-accent`、`--color-on-accent` | `bg-accent-bg`、`text-on-accent` |
| 控件底色与悬停 | `--color-background-control`、`--color-overlay-hover` | `bg-control`、`hover:bg-overlay-hover` |
| 边框与焦点 | `--color-border`、`--focus-outline-*` | `border-border`、`focus-visible:focus-ring` |
| 颜色状态 | `--color-success`、`--color-warning`、`--color-error` 及各自弱化/前景角色 | `text-error` 等当前组件消费 |
| 阴影基础标尺 | `--shadow-scale-empty`、`--shadow-scale-xxs`、`--shadow-scale-xs`、`--shadow-scale-sm`、`--shadow-scale-md`、`--shadow-scale-sr`、`--shadow-scale-doc`、`--shadow-scale-inner` | 由组件语义角色消费 |
| 表面层级 | `--shadow-low`、`--shadow-med`、`--shadow-high` | `shadow-sm`、`shadow-med`、`shadow-lg` / `shadow-xl` |
| 控件与专用表面 | `--shadow-control`、`--shadow-floating`、`--shadow-document`、`--shadow-card-hover` | `shadow-control`、`shadow-floating`、`shadow-document`、`shadow-card-hover` |

阴影标尺参考 2026-10-27 直接核对的 Craft Web CSS，浅色黑色外投影透明度降至 Craft 参考值的 75%（降低 25%），深色保留对应参考值，两种模式的几何参数保持原样。`xxs / xs / sm / md / sr / doc` 去掉原有 1px 外缘层，组件继续使用独立 border；`empty` 保留六层透明值，`inner` 保留独立白色内侧高光（浅色 88%、深色 4%）。`low → xs`、`med → sm`、`high → md`；控件使用 `xxs + inner`，浮动工具条使用 `sr`，独立文档预览使用 `doc`。笔记集合卡片默认使用 `empty`，hover 使用单独的 0 10px 20px 投影（浅色 black / 3%、深色按本项目表面校准为 black / 12%）；普通全屏编辑区保持平面。Storybook 的 [Elevation](../apps/ui/ui/stories/elevation.stories.tsx) 提供完整参数与浅深色真实组件对照，示例内容不连接真实笔记库。

浮层轮廓通过 `--color-border-floating` 和 `--surface-edge-floating` 单独拥有，`surface-floating` utility 将轮廓与 `high` 投影组合。浅色保留既有边框；深色使用黑色 12% 外缘和白色 4% 内缘，布局边框保持 1px 透明，不再叠加白色 10% 描边。菜单、Popover、Select、Combobox、Dialog、Sheet、编辑器弹层与快速记录建议框共用该配方；文档弹窗保留 `document` 投影并组合相同轮廓。输入、按钮和普通卡片保留原边框，焦点环独立。

原生自定义表面的平台阴影由 `NativeSurfaceState.swift` 中的 `NativeElevation` 集中管理，并登记为 `platform.elevation`：快速记录浅色/深色透明度为 9%/12%，半径 24pt、偏移 (0, 8)pt；侧栏抽屉为 11.25%/15%，半径 20pt、偏移 (-8, 0)pt，最终透明度乘展开进度。原生深色保留当前强度、浅色减淡 25%，通过 SwiftUI 的实际 colorScheme 跟随主题，不解析 CSS 多层投影。系统 Sheet、菜单外观仍由 Apple 负责。

悬停、按下、选中、键盘焦点、禁用、只读和校验错误分别表达。使用 Base UI / 原生控件的真实 ARIA、disabled 和焦点机制，不能从颜色推断保存成功或同步完成。图表、syntax 和 brand 角色的登记不证明业务页面已接入；brand 未配置。

## 主题、偏好和单位

主题由 CSS 的 `:root` / `.ui-theme` 与 `data-ui-theme` 解析；WebAppearance 管理产品偏好，PreviewModeProvider 应用当前明暗、字体和圆角。产品存储键为 `memocard-web-appearance-v1`，旧 `memocard-appearance-v1` 只作兼容读取；已有字体与圆角选择保留，恢复默认采用当前 Luma 默认值。Storybook 的 globals 与 fixture 存储独立。

常规圆角选项为 0 / 7.2 / 8 / 10 / 14px 的 16px 根字号基准，派生角色在主题 CSS 中维护；兼容旧设备值不代表仍有一套旧主题。间距基础为 `.25rem`，标准控件高度由 `--size-element-*` 拥有。CSS 长度、Swift 逻辑点与物理设备像素不能直接混同。

原生适配器从实际主题根读取颜色与 `--radius-element`，转换成既有 `NativeSurface.palette / rowRadius` 字段；不在 Swift 重写 CSS 颜色解析。`WebView.swift` 写入 `--ios-top` / `--ios-bottom`，当前原生内容 CSS 使用这些系统值。系统字体、材质、布局和手势继续由平台负责。

## 修改与验证

1. 修改实际权威源，同时更新 registry 和相关消费说明；公开定义、显式覆盖和动态输出都必须有归属。
2. 执行 `pnpm tokens:build`、`pnpm check:design-inventory` 与 `pnpm test:tokens`。生成物禁止手改。
3. 用 `pnpm tokens:check` 检查漂移、未知引用、循环别名、重复/无来源覆盖、所有权和生产入口可达性；生成消费索引排除故事、测试和状态 fixture。
4. 外观或原生 palette 变更执行 `pnpm palette:build`、`pnpm test:palette`，再运行相关 Storybook、产品与原生回归。
5. 执行 `pnpm verify:design` / `pnpm verify:web`，记录真实浏览器、原生协议、构建和设备验收各自的范围。

生成器输出是权威源的派生视图。静态分析不执行任意 JavaScript，也不证明 Portal、Shadow DOM、动态分支和所有偏好组合的实际视觉结果；遇到动态生产方式时补充显式契约与反例。

旧主题生成/继承方案仅作为[历史工程记录](token-engineering.md)保留，不是当前扩展主题的 API。
