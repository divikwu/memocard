# Typography

当前界面和 Storybook 的字体、字号、字重与行高来源为 [theme.css](../apps/ui/ui/theme.css)。默认 UI 正文为 Noto Sans，标题跟随正文；笔记内容的独立偏好由[内容风格](../docs/CONTENT_STYLE.md)拥有。原生系统文字使用[独立平台映射](native-typography.md)。

## 界面标尺与角色

| Token 后缀 | rem | 16px 根字号下的 px |
| --- | --- | --- |
| `xs` | .75 | 12 |
| `sm` | .875 | 14 |
| `base` | 1 | 16 |
| `lg` | 1.125 | 18 |
| `xl` | 1.25 | 20 |
| `2xl` | 1.5 | 24 |
| `3xl` | 1.875 | 30 |
| `4xl` | 2.25 | 36 |
| `5xl` | 3 | 48 |

完整标尺还包括主题中的局部小字号和笔记标题角色；以 [Typography Foundations](../apps/ui/ui/stories/typography.stories.tsx) 和主题目录为准，不把常用表误写成全部定义。

字重为 normal / medium / semibold / bold，即 400 / 500 / 600 / 700。行高按 `--text-body-leading`、`--text-supporting-leading`、各级标题及阅读角色分别维护。`type-body`、`type-label`、`type-supporting`、`type-code` 与 `type-heading-*` 组合实际字体、字号、字重和行高；不再从另一套字号生成 CSS 给产品使用。

UI 字体选项和本地字体加载由 [preview-fonts.ts](../apps/ui/ui/preview-fonts.ts) 拥有，[PreviewModeProvider](../apps/ui/ui/preview-mode.tsx) 输出实际 UI 字体和圆角。正文选项与代码字体有各自白名单，字体资源清单不等于某个界面已加载全部字体。产品出现字体加载失败时展示回退与重试反馈。

## 笔记偏好

存储键保持 `memocard.typography.v1`。默认标题跟随正文、正文 Noto Sans、等宽 Geist Mono、16px 基准、行高 1.6、段距 1em、行宽档位 90。选项由 [preferences.ts](../apps/ui/src/features/typography/preferences.ts) 解析，实际 CSS 输出由 [TypographyProvider](../apps/ui/src/features/typography/TypographyProvider.tsx) 生成。

| 配置 | 可选值 | 默认 |
| --- | --- | --- |
| 字号基准 | 14 / 15 / 16 / 18px | 16px |
| 行高 | 1.6 / 1.75 / 1.9 | 1.6 |
| 段距 | 1 / 1.25 / 2em | 1em |
| 行宽 ID | 60 / 70 / 80 / 90 | 90 |

行宽按保存的字号基准乘以 28 / 33 / 37 / 45，16px 时分别为 448 / 528 / 592 / 720px；ID 不是 CSS `ch`。`--note-size` 按当前主题标尺输出，旧 15px 偏好保留为 .9375rem；它不是新的 UI 基础档位。已有非等宽代码字体可以兼容恢复，新选择与随机搭配只使用 Mono 选项。

[web-typography.css](../apps/ui/ui/web/web-typography.css) 将笔记字体和阅读节奏映射到 Typeset。卡片和搜索预览保留自身摘要密度，阅读配置不改变导航或工具栏；默认摘要及低级标题的实际层级以当前内容 CSS 为准。

## 维护与检查

`pnpm typography:build` 生成当前源码声明使用索引，`pnpm typography:check` 检查漂移；它不拥有主题默认值。完整源码声明见 [typography-usage.generated.json](typography-usage.generated.json)，定义与平台职责见 [覆盖清单](token-coverage.generated.md)。

执行 `pnpm verify:design`，或通过 `pnpm --filter @memocard/ui test:storybook --project ui-quality` 检查当前文字、窄屏、字体失败与减少动态的浏览器质量场景。产品设置、持久化和重载由 `WebTypography.test.tsx`、`WebSettings.test.tsx` 等当前回归覆盖；不继续引用已删除的历史浏览器测试项目。

文字放大、浏览器整页缩放、系统 Dynamic Type 和真实设备是不同验收面。样本数和 bundle 预算以当前测试日志及 [check-ui-bundle.mjs](../scripts/check-ui-bundle.mjs) 为准，不沿用旧主题的数量或体积上限。
