# Typography

采用 [Astryx 的分层思路](https://astryx.atmeta.com/docs/typography)：基础标尺 → 通用文字角色 → 组件消费。项目继续使用 shadcn / Base UI / Tailwind。唯一生产标尺在 [scale.ts](../apps/ui/src/features/typography/scale.ts)，由 [生成器](../scripts/build-typography-scale.mjs) 输出 CSS；不引入另一套组件库或按组件复制文字变量。

## 基础标尺

| 字号 | rem | 16px 根字号下的 px |
| --- | --- | --- |
| xs | .75 | 12 |
| sm | .875 | 14 |
| base | 1 | 16 |
| lg | 1.125 | 18 |
| xl | 1.25 | 20 |
| 2xl | 1.5 | 24 |
| 3xl | 2 | 32 |

七档共用 `--font-size-*`，Tailwind `text-xs…text-3xl` 适配到同一标尺。旧零散 11 / 13 / 15px 界面文字分别归入 12 / 14 / 16px；默认摘要归入 14px，内容一级标题归入 24px。按用户确认，接受这些局部变化，字号统一随根字号缩放。默认正文仍为 16px，页面宽度不变。

字重沿用 normal / medium / semibold 命名，即 400 / 500 / 600；数值由 scale.ts 唯一声明并生成 @theme，文档与工具类读取同一来源。标题与强调共用 600。旧 bold 名称映射至 semibold，保留兼容入口，不再提供第四档系统字重；字体文件的可变字重范围和用户富文本内容不裁剪。

行高只提供三种策略：`--leading-tight` 1.25（标题）、`--leading-normal` 1.5（界面）、`--leading-relaxed` 1.75（长文）。文字角色按策略计算行盒：字号 × 倍率，取最近的 4px 网格，并保证行盒至少比字号多 4px；计算以 16px 根字号为基准，再输出无单位倍数。比如 24px 紧凑标题得到 32px 行高，14px 标准标签得到 20px 行高。生成的七个 `--line-height-*` 是字号工具类的适配结果，不是七档可选策略。图标、上下标等局部几何仍可使用 1 / 0 / inherit，不是额外文字样式。

## 通用文字角色

每个角色由 `--text-{role}-size / weight / leading` 三项组成。同一 manifest 定义字号、字重和行高策略，生成完整 CSS 样式。

| 角色 | 字号 | 字重 | 行高策略 | 默认行盒 |
| --- | --- | --- | --- | --- |
| title 页面标题 | 32px | 600 | 紧凑 | 40px |
| heading 大标题 | 24px | 600 | 紧凑 | 32px |
| subheading 小标题 | 20px | 600 | 紧凑 | 24px |
| large 大正文 | 18px | 600 | 标准 | 28px |
| body 正文 | 16px | 400 | 标准 | 24px |
| label 标签与控件 | 14px | 500 | 标准 | 20px |
| supporting 辅助文字 | 12px | 400 | 标准 | 20px |
| code 代码 | 14px | 400 | 标准 | 20px |

字体与文字样式分开：界面读取 `--app-font-body / heading`；笔记读取 `--note-body-font / heading-font / mono-font`。字体选项只是可加载资源，28 个字体样本仍按需加载，不为每个字体建立新角色。

## 组件消费与局部映射

- Button、Tabs、菜单、Select、输入组等共享 `type-label`；普通菜单文字和 Select 显式使用 font-normal 保留 400，辅助文字使用 supporting。Input / Textarea 使用 body，桌面尺寸引用 label 的字号与行高；Dialog 标题使用 large 并保留 leading-none 密度。xs 尺寸和调用方 utilities 仍可覆盖。页面标题消费 `type-title` 或对应完整三元组。
- `.markdown.typeset` 将 body 映射到用户阅读字号与行高，标题和代码的共享字号应用同一个阅读倍率。h1…h6 分别消费 heading / subheading / large / body / label / supporting；低级标题保留强调字重。段距和布局不归入文字 token。行内代码在标题、strong / b 内继承强调字重，普通行内代码及代码块仍使用常规字重。
- 卡片映射到 14px / 20px，标题压平与强调文字共用 label 字重；段距保留 .4em。摘要为 14px，18px 阅读设置下为 16px，段距保留 .75em。
- 搜索标题使用 subheading；搜索正文为 14px / 20px，h1 / h2 为 16px / 24px，h3 为 14px / 20px，段距保留 .85em。
- 编辑器行内工具、格式菜单、属性菜单、表格工具、公式输入、标签建议和插入菜单均消费 label 的字号与行高；保留块提示和表格滚动提示消费 supporting。字体简写不再绕过七档标尺，原 11px 提示归入 12px、13px 工具归入 14px。
- 局部组件覆盖通用角色的输入，不新增全局 `note-card-*` 或 `note-search-*` 字体角色。使用目录保留所有声明的实际来源与作用域。

## 用户设置与兼容

存储键保持 `memocard.typography.v1`，所有选项 ID、默认值、字体选择、旧比例代码字体读取、Provider 同步和保存行为保留。阅读 size 仍接受 14 / 15 / 16 / 18；默认 16，旧 15 作为个人偏好的 .9375rem 兼容值，不成为第八档基础字号。`--note-size` 输出 rem，`--note-scale` 是字号 / 16；根字号 20px 时默认正文为 20px。设置与诊断故事明确标注“px 基准”，避免将保存值误认为当前计算像素。

### 阅读偏好配置

可选值和默认值由 [preferences.ts](../apps/ui/src/features/typography/preferences.ts) 定义，运行时映射由 [TypographyProvider.tsx](../apps/ui/src/features/typography/TypographyProvider.tsx) 实现。以下记录阅读设置的可选值与默认值，供设置维护与历史数据兼容使用。

| 配置 | 可选值 | 默认值 |
| --- | --- | --- |
| `size` | 14px 基准 / 15px 基准 / 16px 基准 / 18px 基准 | 16px 基准 |
| `leading` | 1.6 / 1.75 / 1.9 | 1.6 |
| `measure` | 60 / 70 / 80 / 90 | 90 |
| `flow` | 1em / 1.25em / 2em | 1em |

旧阅读行高 1.6 / 1.75 / 1.9 和默认 1.6 继续解析，作为用户偏好覆盖三种策略，不新增为系统档位。段距仍为 1em / 1.25em / 2em。

阅读宽度仍为设置字号 × 原系数，measure ID 不是 CSS ch；根字号变化不另行改写此宽度公式。页面最小宽度固定为 320px，避免原 20rem 最小宽度随文字放大而将窄屏撑宽；默认页面宽度和响应式断点保持。

### 阅读宽度计算

公式中的“设置字号”是保存的 px 基准值（例如 `16`），而非根字号缩放后 `--note-size` 的计算像素。结果以 px 写入 `--note-measure`，容器再沿用既有响应式宽度限制。

| 档位 | 兼容 ID | 计算规则 | 16px 默认字号下的宽度 |
| --- | --- | --- | --- |
| 窄 | `60` | `设置字号 × 28` | 448px |
| 适中 | `70` | `设置字号 × 33` | 528px |
| 宽 | `80` | `设置字号 × 37` | 592px |
| 宽松 | `90` | `设置字号 × 45` | 720px |

原组件变量、fixed 尺寸、数字行高和 heading-1…6 名称保留在 [tokens.css](../apps/ui/src/features/typography/tokens.css)，登记为 adapter / alias，退出生产消费和默认文档。原有故事 ID 与隐藏测试保留。所有定义、别名与消费者由 [registry](tokens/registry.json) 和生成的完整 [覆盖清单](token-coverage.generated.md) 记录。

## 文档与维护

Typography 只公开 Docs，展示通用文字样式、字体、基础字号、基础字重、基础行高五个分区。原 `foundation-typography-notes` 和 `foundation-title-typography-notes` 锚点作为通用文字样式标题的兼容定位点保留，旧链接仍可访问；页面不保留空分区或迁移提示。阅读偏好与宽度计算表在本工程文档维护；原生字号基准和 Swift 用法移至 [原生排版工程说明](native-typography.md)。字号只有一张 Token / Value / Example 表，展示 rem 原值、当前实际 px 与样本；字重三行、行高策略三行，角色表显示实际组合指标。完整工程声明索引保留在 [typography-usage.generated.json](typography-usage.generated.json)，不将局部声明自动提升为公开 token。

运行 `pnpm typography:build` 和 `pnpm tokens:build` 更新生成物，`typography:check / tokens:check` 检查漂移。单元测试覆盖全部 144 组阅读偏好、字体兼容与七档标尺计算；浏览器回归检查完整定义、原始 ID、懒加载字体、实际组件级联、根字号变化和用户设置覆盖。保留 Typography 与 Button 的交互场景测试。

原生仍按既有 pt / 系统文字样式 / Dynamic Type 使用独立映射。四项逻辑字号基准与 21 项原生表达式在原生工程文档中保留来源，明确 desktopFontSize 没有原生直接消费者；不改 Swift 字体、原生布局与字号缩放，也不把 Web 测试视为真机验收。

## 跨浏览器回归

[typography-system.browser.tsx](../apps/ui/stories/typography-system.browser.tsx) 使用真实 Button、Tabs、Select、菜单、输入组、Markdown 和设置组件，覆盖角色调整后的级联、普通/小号覆盖、行内代码强调与旧存储值。320 / 390 / 1368px 浅深色下，将根字号 16 → 20 → 32px（100% / 125% / 200% 文字缩放），同时覆写行高 1.5、段后距 2em、字距 .12em、词距 .16em，检查文字边界、内容换行和操作。这是文字缩放检查，不冒充操作系统设置或浏览器整页缩放验收。

本地默认运行 Chromium / WebKit：`pnpm --filter @memocard/ui test:storybook --project 'typography-*'`。首次运行先安装 `playwright install chromium webkit`；CI 安装并运行 Chromium / Firefox / WebKit 全矩阵。本机 macOS 27 的 Firefox 在页面启动前报 profile 错误，与 [Mozilla 上游问题](https://bugzilla.mozilla.org/show_bug.cgi?id=2060476)相符，尚未完成 Firefox 验证；可用 `STORYBOOK_FIREFOX=1 pnpm --filter @memocard/ui test:storybook --project typography-firefox` 显式重试。此限制不跳过原有测试；完整 Firefox 任务仍在 CI 配置中，未将配置完成称为 CI 通过。

## 构建体积边界

共享标尺、八种文字角色与旧 token 兼容定义带来公共 CSS 增量，初始原始 CSS 预算由 95 KiB 调整到 102 KiB；首屏 JS + CSS 的 188 KiB gzip 上限保持。包含共享 CSS 和真实 italic 加载器的各路由在原预算上预留 12 KiB 原始大小 / 2 KiB gzip。普通拉丁字体仍限制在 1 MiB，按需 italic 文件独立限制在 1 MiB，中文分片仍为 5 MiB；这些是打包资源上限，不代表首屏全部下载。所有边界由 `scripts/check-ui-bundle.mjs` 验证。
