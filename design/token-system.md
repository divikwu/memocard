# MemoCard token 定义规范

现行产品、唯一 Storybook 和状态 Preview 共用 Luma / Base UI 主题。默认浅色、黑白强调色、Neutral、Noto Sans、8px 控件圆角。入口与职责总览见[设计维护入口](README.md)，工程消费见[Token 消费映射](token-consumption.md)。

## 权威来源

| 内容 | 当前来源 | 维护边界 |
| --- | --- | --- |
| 语义颜色、字体标尺、尺寸、圆角、动效、Tailwind 别名 | [theme.css](../apps/ui/ui/theme.css) | 产品和 Storybook 使用同一份定义；`@theme reference inline` 提供工具类映射 |
| 强调色与中性色覆盖 | [web-palette.css](../apps/ui/ui/web/web-palette.css)、[WebAppearance](../apps/ui/ui/web/WebAppearance.tsx) | 明暗/系统、8 种强调色、2 种中性色；显式覆盖同名语义角色 |
| UI 字体与圆角选择 | [preview-appearance](../apps/ui/ui/preview-appearance.ts)、[preview-mode](../apps/ui/ui/preview-mode.tsx)、[字体资源](../apps/ui/ui/preview-fonts.ts) | 名称源于早期预览目录，现由产品和示例共同消费 |
| 笔记内容风格 | [preferences.ts](../apps/ui/src/features/typography/preferences.ts)、[TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx)、[web-typography.css](../apps/ui/ui/web/web-typography.css) | 正文、标题、等宽字体及阅读节奏；不改变导航工具栏 |
| 标签及 Callout | [tag.css](../apps/ui/ui/business/tag.css)、[note-content.css](../apps/ui/ui/business/note-content.css) | 复用主题色系，局部角色和保存标识由业务组件拥有 |
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
| 阴影基础标尺 | `--shadow-scale-0` 至 `--shadow-scale-4` | 由组件语义角色消费 |
| 表面层级 | `--shadow-flat`、`--shadow-low`、`--shadow-med`、`--shadow-high` | `shadow-flat`、`shadow-low`、`shadow-med`、`shadow-high` |
| 控件高光 | `--surface-highlight-control` | 由 `--shadow-control` 组合 |
| 控件与专用表面 | `--shadow-control`、`--shadow-floating`、`--shadow-document`、`--shadow-card-hover` | `shadow-control`、`shadow-floating`、`shadow-document`、`shadow-card-hover` |

### 阴影分层与使用入口

阴影按三层维护，同一语义角色的 CSS 变量与工具类使用相同后缀：

| 层 | 职责 | 示例 |
| --- | --- | --- |
| 基础尺度 | 五档递增外投影，拥有几何参数与浅深色数值，仅供语义角色和标尺展示引用 | `--shadow-scale-2` |
| 语义角色 | 按表面或状态选择配方，是组件 CSS 的消费接口 | `--shadow-low`、`--shadow-input-focus` |
| Tailwind 适配 | 从语义变量生成同名 JSX 工具类，不拥有另一份阴影数值 | `shadow-low`、`shadow-input-focus` |

这遵循 [Tailwind 的 shadow 主题变量接口](https://tailwindcss.com/docs/box-shadow#customizing-your-theme)。新组件直接使用语义角色，由角色选择基础高度；不在组件中直接引用数字尺度。

`shadow-flat` / `--shadow-flat` 映射 `scale-0`，用于需要平滑过渡的平面表面；`shadow-none` / `box-shadow: none` 用于明确清除阴影，两者职责不同。快速记录默认使用 `shadow-low`，聚焦使用 `--shadow-input-focus`（当前映射 `med`）；Card 默认使用 `shadow-med`。高层浮窗显式使用 `surface-floating shadow-high`；前者拥有布局边框与独立高光，后者选择含外缘的投影。覆盖成 `shadow-low / shadow-document` 时保留高光；`shadow-none / shadow-flat` 恢复普通边框；仅需要投影的普通表面直接使用 `shadow-high`。

目标模式只开放同名语义工具类，不保留旧尺寸别名。`@theme reference inline` 首先以 `--shadow-*: initial` 清空 Tailwind 默认阴影命名空间，再显式登记 `flat / low / med / high` 和已有专用角色，避免删除映射后重新启用上游默认值。命名空间重置属于编译配置，不是运行时 token；基础尺度仍由主题 CSS 拥有。`shadow-none` 继续作为清除工具使用。

阴影包含轻薄的装饰外缘，但不承担结构分隔、焦点描边或校验状态职责。`effects.surface-edge` 管理装饰轮廓；`effects.state-feedback` 单独登记现有 inset 状态定义，当前没有生产消费者，按 `reserved` 保留变量，不导出 `shadow-inset-*` 工具类，也不作为已开放的组件组合接口。原生阴影仍由各平台适配器维护。

基础尺度 0–4 使用递增的多层外投影，浅深色共享几何结构、分别设置各层透明度。等级 0 保留六层透明值；等级 1 为两层投影与一层 1px 外缘，投影的垂直偏移 / 模糊为 `(1, 1.5)`、`(2.5, 4)`；等级 2–4 为五层投影与一层 1px 外缘，第一层投影分别为 `(1, 1)`、`(2, 4)`、`(4, 9)`，单位为 px。透明占位层保留以支持过渡。等级 1 的外缘浅色 / 深色透明度为 4% / 12%，等级 2–3 的外缘浅色 / 深色透明度为 6% / 12%，等级 4 为 3% / 12%。完整参数以主题 CSS 为准；不再要求固定两层或逐档翻倍。

语义角色映射为 `flat → 0`、`control → 1`、`low / floating → 2`、`med / document → 3`、`high → 4`。`card-hover → low`、`input-focus → med` 复用已有高度，不维护独立投影配方。控件高光由 `--surface-highlight-control` 单独拥有，白色 1px inset 的浅色 / 深色透明度为 88% / 4%，仅由 `control` 组合，不列入高度尺度。旧尺度名称已移除，不保留兼容别名。普通全屏编辑区保持平面。Storybook 的 [Elevation](../apps/ui/ui/stories/elevation.stories.tsx) 提供完整参数与浅深色真实组件对照，示例内容不连接真实笔记库。

浮起表面的装饰外缘由基础投影拥有，避免重复叠加。`--color-border-floating` 在常规浅深色模式下为透明，保留 1px 布局占位；`--surface-edge-floating` 只补充深色 white / 4% 内侧高光，浅色为透明。`surface-floating` utility 使用独立组合槽承载高光，浮层组件另显式选择 `shadow-high`。显式覆盖为 `shadow-none` 或 `shadow-flat` 时恢复普通边框；强制颜色模式使用系统色边界。菜单、Popover、Select、Combobox、Dialog、Sheet、编辑器弹层与快速记录建议框共用该配方；文档弹窗保留 `document` 投影并组合相同轮廓。输入与按钮的状态边框、结构分隔和焦点环独立。普通浮起卡片和 PC 快速记录保留透明布局边框；平面笔记卡片保留弱边框，hover 后由投影外缘接替；移动端无投影输入面板恢复弱边框。

z-index 决定实际的前后顺序，阴影等级表达感知高度；嵌套菜单、Popover 与 Dialog 可以复用 `high`，不要求每叠加一层就提高尺度。嵌入式移动面板、表格与图片工具条保持平面；反色 Tooltip 通过实心底色与箭头分离内容。这些例外不因定位悬浮就自动添加投影。

阴影基色由主题的 `--color-shadow` 拥有，组件不使用 `shadow-red-500` 等自由染色类。工具类能共存不代表实际阴影支持染色，目录不把该变量宣传为颜色 utility 接口。几何与明暗透明度仍在基础尺度中维护。

键盘焦点由 `--focus-outline-*` 独立维护：2px 实线、向外偏移 2px，浅色使用不透明 `neutral-600`，深色使用不透明 `neutral-400`。强制颜色模式的焦点与浮层布局边框使用系统前景色 `CanvasText`，与 `Canvas` 背景配对，在浏览器移除投影后保留可辨识的边界；不使用投影作为唯一焦点提示。

输入焦点统一由 PreviewModeProvider（产品外观、Preview 与 Storybook 的共同入口）安装页面级输入方式检测。整个 document 只维护一组 keydown / pointerdown / focusin 捕获监听，兼容嵌套 provider 和 portal；最后一个 provider 卸载后清理监听并恢复原属性。鼠标与触控不显示焦点框，Tab、选择器选项导航、单行提交与 Escape 切换为键盘方式；文本输入、IME、文本光标移动和多行换行保留当前方式。单行、多行、复合、搜索、选择、富文本弹层及自动聚焦字段共享同一规则，复合字段只由容器绘制焦点框，校验边框与错误 ring 独立保留。快速记录的 contenteditable 保留 `data-slot=input-group-control`，pointer 聚焦继续增强 `input-focus` 投影。不能单靠 `:focus-visible` 区分输入方式，因为文本编辑区通过鼠标聚焦也可能匹配。

文章卡片、Preview 入口与 Elevation 示例共同消费 [card-hover.css](../apps/ui/ui/components/card-hover.css) 的两项独立能力：`ui-card-hover-shadow` 只提供 flat → card-hover（low）投影，`ui-card-hover-scale` 只提供 1.02 倍缩放。文章卡片和 Preview 显式组合两者，Elevation 阴影示例只使用前者；仅桌面精细指针悬停时生效，过渡使用 600ms，减少动态效果时为 0ms 且取消缩放。键盘焦点保持独立描边；列表布局和不可打开卡片不接入 hover 配方。

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
