# 侧栏试点验证记录

> 历史范围（2026-10-25 标记）：本页保留各日期的设计验收结果和当时源码入口，旧端口、源码路径、默认外观及主题 API 不再作为现行维护契约。当前规则见[现行规范](README.md)。被删除的源文件可用 `git show 6214317:<仓库相对路径>` 查看迁移前快照；本机 ignored 证据路径不保证在新克隆中存在。


本文件随实际检查更新。尚未执行的检查不得标记通过。

## 全部本地修改提交前审查（2026-10-22）

- 审查 Foundations、公共 token 源及生成器、生产消费、Typography 设置兼容与字体加载、Storybook 隐藏入口和 CI。修复编辑器工具栏、表格工具、公式输入、标签建议、插入菜单和提示中的固定字号简写，将其接入 label / supporting；补上 Chromium / WebKit 的实际 CSS 角色覆盖与 100% / 125% / 200% 根字号缩放检查（共 20 项 Typography 浏览器测试通过）。
- 补回原 `foundations-tokens--live-palette` 隐藏兼容入口，复用 Color 的原夹具与交互测试，避免旧链接失效。原有 19 个 Foundations Story / Docs ID 均保留；当前共有 38 个 Foundations 条目、152 个 Storybook 条目。原主题源抽取的 277 个作用域 / 名称 / 值组合逐项与提交基线一致，未改变颜色默认值或主题规则。
- 首次全量 Web 检查发现历史体积预算未纳入共享角色、兼容变量与真实 italic 资源；按实际增量设置原始 CSS 和路由预留，并为按需 italic 单独设 1 MiB 上限。首屏 gzip、普通字体、中文分片和 JS 单文件原有上限保留；详见排版工程文档的体积边界。最终产物首屏 gzip 为 192447 字节，普通字体 908432 字节、可选 italic 836504 字节、可选中文分片 4500544 字节，全部体积检查通过。
- `pnpm verify:web`、`pnpm verify:design`、`pnpm verify:native`、`pnpm test:service`、`pnpm test:sidebar-native`、`pnpm audit --prod` 通过。包含 1101 项 UI 单元测试、311 项完整 Storybook 浏览器检查、129 项 native-core XCTest、8 项服务 XCTest及相关 Node 测试。设计检查同时验证所有目录生成漂移、类型、ESLint、静态构建、原生预览 palette 与使用清单；本机未运行 Firefox，GitHub CI 会运行三种浏览器。
- GitHub 首轮 Linux CI 检出 registry 两处消费者路径写成 `Markdown.tsx`（实际为 `markdown.tsx`）。修正 registry 并重新生成覆盖清单，生成器增加文件名大小写校验；17 项 token 测试和漂移检查通过，避免本机默认大小写不敏感文件系统再次漏检。
- 最终静态构建后，补验原 All tokens 四项场景与六组 Docs，10 项全部通过，包含恢复旧 Live Palette ID 后的真实交互与隐藏导航验证。
- 完整审查及修复证据在 `build/verification/premerge-review/`。未修改 Apple / native-core / local-service 的生产源码，不将本机纯逻辑检查视为原生真机行为验收。蓝色 primary 的既有对比度问题继续如实保留在断言和工程记录中，没有通过降低门槛将其标成 AA 通过。

## Color 语义色独立分区（2026-10-22）

- Color Docs 将原 35 项语义色按用途拆为基础表面与文字（8）、操作与状态（10）、边界与反馈（4）、侧栏（8）、图表（5）五个独立分区和表格，背景与对应前景相邻排列。Tag、Callout、Palette 保持独立，目录共八项；预留角色继续明确标注。所有值仍由生产 CSS 解析。
- 原 `foundation-colors` / `foundation-title-colors` ID 保留在首组，其余原锚点不变。All tokens 保留原总览表和分区；没有修改全局排版样式、页面宽度或颜色规则。
- 静态 Foundation Docs 六组（320 / 390 / 1368px × 浅深色）通过，新增五组归属和顺序、独立表格、八项目录及分组锚点跳转验证；原完整性、无重复、主题值、统一排版与 Diagnostics 检查继续通过。Storybook 构建、类型、相关 ESLint、tokens:check 与 diff 检查通过。
- 全部 151 个 Storybook 条目及元数据保持一致；267 份受保护文件哈希一致，包含生产与原生源码、原颜色故事及诊断配对定义、token 定义和覆盖清单。原颜色测试未修改，本轮未重复执行 Canvas 测试。证据在 `build/verification/color-sections/`，实际浏览器截图为 `color-docs-live.png`。未提交或发布。

## Color 仅保留 Docs 导航（2026-10-22）

- Color 的 Default（展示名 Diagnostics）移除 dev 标签，导航只保留 Docs。原 `foundations-colors--default` ID、直达路由、22 组配对结果及所有隐藏场景和交互测试继续保留。README 和颜色诊断工程说明同步导航归属；没有修改色值、组件消费或对比度判定。
- 原颜色 Canvas 11 项测试通过；静态 Foundation Docs 六组（320 / 390 / 1368px × 浅深色）通过，新增导航只显示 Docs、诊断原 URL 可加载且不重新出现在导航中的断言，保留原配对测量检查。Storybook 构建、类型、相关 ESLint、tokens:check 与 diff 检查通过。
- 全部 151 个 Storybook ID 保留，元数据仅 Color Default 与派生 Docs 移除 dev 标签，test 标签保持。266 份受保护文件哈希一致，包含 UI 生产源码及测试、Apple Sources、原配对定义、token 定义与覆盖清单。结构化清单仍为 282 项 CSS、13 项运行时、28 项可移植基准、17 项所有权、4 项外部变量。
- 现有浏览器页面确认 Color 只有 Docs 入口。证据在 `build/verification/color-docs-only/`，截图为 `sidebar-live.png`。未提交或发布。

## Size & density 入口隐藏与内容归属整理（2026-10-22）

- 新增 Storybook manager 的 sidebar filter，仅隐藏 foundations/sizing 分组及条目。原 Docs / Reference 索引、ID、test 标签、直接 URL 和全部验收夹具不变；All tokens 继续展示完整十五项侧栏尺寸。已重启本地 6006 Storybook 以加载 manager 配置，并刷新用户已有页面，实际导航中不再出现 sizing。
- Button Docs 保留已有八种尺寸示例；Input 文档补充默认高度、移动/桌面字号和 InputGroup 组合尺寸，Textarea / Select / Tabs 文档说明最小高度或大小变体。Sidebar Docs 从生成常量读取行高、图标、视觉框与命中区，Sidebar 规格补充文字放大规则；跨端映射与隐藏验收夹具的维护说明归工程文档。没有创建全局密度档位或改动组件规则。
- 新增页面回归检查侧栏无 sizing、原 Docs 直达仍可加载、相关组件及 Sidebar 文档包含尺寸说明。原 Chromium / WebKit 尺寸与 Typography 34 项、组件 / 侧栏交互和断点 46 项、静态 Foundation Docs 六组（320 / 390 / 1368px × 浅深色）通过；Storybook 构建、类型、相关 ESLint、tokens:check 与 diff 检查通过。Firefox 未在本轮重新验证。
- 全部 151 个 Storybook 索引条目及元数据与本轮基线一致，其中 Foundations 37 项。268 份受保护文件哈希一致，包含 UI 生产源码及测试、Apple Sources、DTCG / registry / 完整覆盖清单、原 Sizing Docs / Reference 源和实测 / 200% 文字放大测试。结构化清单仍为 282 项 CSS、13 项运行时、28 项可移植基准、17 项所有权、4 项外部变量。
- 证据在 `build/verification/sizing-ownership/`，用户现有标签页刷新后的截图为 `sidebar-live.png`。本轮只调整 Storybook 导航、文档与页面验证，未改变生产或原生行为，未提交或发布。

## 原生排版表移至工程文档（2026-10-22）

- Typography Docs 只展示通用文字样式、字体、基础字号、基础字重、基础行高五个分区。原生字号基准和原生文字用法表移至 `design/native-typography.md`，保留四个逻辑基准、21 项原表达式、38 处源码位置，并明确 desktopFontSize 只有生成的 Swift 常量、没有原生直接消费者。README、通用 Typography 与工程维护说明补充原生文档入口。
- 保留 `foundation-typography-notes` 和 `foundation-title-typography-notes`，作为通用文字样式标题内的兼容定位点；导航中不再出现原生分区，页面不保留空分区或迁移提示。浏览器回归检查五个可见分区、旧锚点唯一且定位到通用标题、两表不再展示，以及工程文档逐项保留基准、表达式与来源。
- 原设置/兼容与字体样本单元测试 13 项、Typography Canvas 交互 4 项、静态 Foundation Docs 六组（320 / 390 / 1368px × 浅深色）通过；Storybook 构建、类型、相关 ESLint、tokens:check、typography:check 与 diff 检查通过。只调整页面与工程文档，没有改动原生代码或行为，不将 Web 检查视为原生真机验收。
- 266 份受保护文件哈希一致，包含 UI 生产源码及测试、Apple Sources、原 Typography 故事、registry、可移植定义、两份完整覆盖清单与排版使用目录。清单仍为 282 项 CSS、13 项运行时、28 项可移植基准、17 项所有权、4 项外部变量；37 个 Foundations 索引条目与元数据一致。证据在 `build/verification/native-typography-docs/`。未提交或发布。

## 阅读偏好与宽度计算表移至工程文档（2026-10-22）

- Typography Docs 移除阅读偏好配置表和阅读宽度计算表，完整选项、默认值、四档宽度映射与来源链接保留在 `design/typography.md`。宽度公式明确使用保存的 px 基准字号，而非浏览器根字号缩放后的实际字号。`foundation-typography-notes` 和对应标题 ID 保留，分区名称调整为“跨端文字基准”，继续展示原生 pt 基准与原生文字规则。
- 页面回归改为检查两表不再出现在 Docs、工程文档完整保留四项配置及四档宽度；原有设置和隐藏诊断故事未改。设置、Provider 兼容与字体样本单元测试 13 项、原 Typography Canvas 交互 4 项、静态 Foundation Docs 六组（320 / 390 / 1368px × 浅深色）通过；Storybook 构建、类型、相关 ESLint、tokens:check 与 diff 检查通过。
- 264 份受保护文件哈希一致，包含 UI 生产源码及其测试、Apple Sources、原 Typography 故事、registry 与两份完整覆盖清单。结构化清单仍为 282 项 CSS、13 项运行时、28 项可移植基准、17 项所有权、4 项外部变量；37 个 Foundations 索引条目与元数据一致。证据保存在 `build/verification/typography-preferences-docs/`。本轮仅调整文档与页面验证，未改设置功能、缩放或宽度规则，未提交或发布。

## Size & density 整理与放大文字回归（2026-10-22）

- Docs 保留 `foundation-sizing` 锚点和十五项跨端侧栏基准。Web 控件与跨端基准分开说明，表格统一为两列；横条与基准数值并排。直接渲染并测量十五项生产控件样本，覆盖八种 Button 尺寸、Input、InputGroup、Select 两档、Tabs 两档与 Textarea；图标按钮显示宽高与图标尺寸。根字号变化后自动更新数值，Select 保留真实选择交互。All tokens 不重复分类页的控件样本，Reference 继续隐藏。
- 浏览器回归复现侧栏放大后行盒不足：默认桌面 32px、移动最小 48px 保留，行高与 `1lh + .75rem` 取最大值，垂直内边距同步匹配。200% 文字下桌面行 64px、移动行 72px；原 768px 断点、横向单行截断、侧栏宽度、展开控件视觉框和 44px 命中区不变。
- 修复 InputGroup 行内输入原 36px 超出 32px 外框的问题；输入填满边框内部、文字垂直居中。仅调整行内 addon 内边距，分块 addon 保留原值；分块输入保留独立 36px 高度，避免 flex 收缩。快速记录使用的分块 footer、组件 API、事件和焦点交互保留。
- Chromium / WebKit 共 34 项通过：原 Typography 18 项与新增密度 16 项；覆盖 320 / 390 / 1368px、根字号 16 / 20 / 32px、侧栏默认尺寸和文字容纳、嵌套行展开、移动展开按钮命中区、输入组边界、点击 addon 聚焦、Tabs、Docs 实测值和 Select 选择。此处是文字放大，不等同于全部浏览器缩放 / WCAG 或原生 Dynamic Type 真机验收。
- 原有组件与侧栏 Canvas / 断点 46 项、UI 单元测试 1,101 项、静态 Foundation Docs 六组（320 / 390 / 1368px × 浅深色）、token 16 项通过。生产与 Storybook 构建、类型、相关 ESLint、定义漂移、设计清单与 diff 检查通过；构建仍有既有大 chunk 提示。Firefox 沿用已配置的 CI 矩阵，本机 macOS 启动问题仍未解除，本轮未声称其通过。
- 完整结构化覆盖清单与本轮基线一致：282 项 CSS、13 项运行时、28 项可移植基准、17 项所有权、4 项外部变量；37 个 Foundations 索引条目及元数据一致，356 份 Apple 文件哈希一致。Markdown 消费索引随实际工具类更新，未删除定义或测试。证据位于 `build/verification/density/`，截图位于 `build/verification/foundation-reference/sizing-docs-*.png`。未提交、推送或发布。

## Typography 审阅问题修复与缩放回归（2026-10-21）

- 修复四项审阅问题：标题、strong / b 内的行内代码继承强调字重，普通行内代码和代码块继续为 400；Tabs、菜单、Select、输入组、辅助文字等接入共享文字角色，普通字重、xs 尺寸与控件密度保留显式覆盖；字重的 400 / 500 / 600 从 scale.ts 唯一生成到 @theme，文档与生产共享来源；设置、Docs 和隐藏诊断故事将保存字号标为“px 基准”，保留原选项 ID、存储键和 15px 兼容。
- 新增回归发现原 body 的 20rem 最小宽度随根字号增长，在 320 / 390px 窗口放大文字会产生水平滚动。改为同默认尺寸的固定 320px 最小宽度；默认正文仍为 16px，默认阅读宽度仍为 720px。宽度公式、字号档位、默认行高、段距、字体和原生规则不变。
- 全部 UI 单元测试 1,101 项通过；16 项 token 与 6 项排版目录测试通过。原 Typography、Button、Tabs、Select、菜单、Input、Textarea、Dialog、Sheet、Popover、Tooltip 场景共 39 项交互测试通过，项目标签导致的不适用场景保持跳过。
- Chromium / WebKit 新增矩阵共 18 项通过，使用真实组件与真实 Provider：修改 label 角色同时检查按钮、Tabs、输入组、Select 和 portaled 菜单的实际级联；检查常规/小号局部覆盖、行内代码强调、旧偏好保存及默认 720px 宽度。320 / 390 / 1368px × 浅深色，按 16 / 20 / 32px 根字号验证 100% / 125% / 200% 文字缩放，再同时覆写行高 1.5、段后距 2em、字距 .12em、词距 .16em，核对文字边界、换行、无整页横向溢出及操作可用。此处是文字缩放，不声明真实整页浏览器 zoom、OS 设置或全面 WCAG 验收。
- Firefox 已安装，当前 Playwright Firefox 157.0 在 macOS 27.0.1 页面启动前即报 “Could not find profile folder.”，未执行产品测试；结果与 Mozilla 2060476 所述直接启动问题相符。没有修改系统隐私权限或把启动失败改为通过。本地默认运行 Chromium / WebKit，可用 STORYBOOK_FIREFOX=1 显式重试；CI 已配置安装并运行三引擎矩阵，但本轮没有执行或宣称 CI 成功。
- 静态 Docs 六组回归、生产/Storybook 构建、Storybook 类型、相关 ESLint、目录/覆盖漂移、设计清单和 diff 检查通过。桌面字重表和 WebKit 的 390px / 200% 文字样本已查看。原 37 个 Foundations ID 及元数据保留，原 279 项 CSS 名称/声明值、13 项运行时、28 项跨端、17 项所有权和 4 项上游输出保留；新增 3 项受控字重定义，完整清单为 282 项 CSS（171 项非 adapter）。356 份 Apple 文件哈希一致，未执行原生构建或真机验收。
- 证据：`build/verification/typography-optimization/` 中最终 UI / Canvas / 多浏览器 / Docs / token / 目录 / 类型 / lint / 构建 / 漂移 / inventory 日志、`preservation.json`、`firefox-status.json` 及两引擎截图。200% 截图为应用默认契约值的生产 CSS 夹具，Provider 的真实默认宽度与设置行为由新增浏览器测试独立验证。

## Typography 统一标尺与角色重构（2026-10-21）

- 按用户后续确认，将生产字号统一为七档 rem（12 / 14 / 16 / 18 / 20 / 24 / 32px 基准），接受零散字号归档的小幅变化，替代本文件较早记录中的固定 px / rem 并行方案。字重只保留 400 / 500 / 600；行高只提供紧凑 1.25、标准 1.5、宽松 1.75 三种策略，文字角色按字号和 4px 基准网格生成实际行盒。八种通用角色消费同一 manifest；原组件变量、fixed 尺寸、数字行高和旧标题角色转为兼容 adapter，不再作为新规范入口。
- 默认正文仍为 16px、阅读宽度仍为 720px；字号统一随根字号缩放，阅读宽度仍按设置字号 × 原系数计算。全部旧字体与四轴设置兼容，包括旧 15px 个人字号及 1.6 / 1.75 / 1.9 阅读行高；默认行高仍为 1.6。原生 pt、系统文字样式和 Dynamic Type 规则未改。
- 全部 UI 单元测试 1,100 项通过（含 Typography 偏好的 144 组组合、字体加载、搜索及预览测试）；16 项 token 测试、6 项排版目录测试通过。Typography 四个原故事与 Button 交互合计 15 项 Canvas 测试通过，另一个不适用项目按既有标签跳过。App 原网格测试保留布局断言，将 32px 字面量类断言改为共享 title 角色。
- 开发与静态 Docs 各六组浏览器回归通过（320 / 390 / 1368px × 浅深色），覆盖完整定义、原分区、ID、统一布局、无溢出、字体按需加载、三档字重和三种策略的实际计算值。隔离生产样式夹具核对页面标题、正文/标题/代码、卡片、摘要、搜索与按钮；改变阅读参数和角色字重，并在根字号 20px 下验证缩放与固定的宽度公式。现有 reduced-motion 全局规则仍产生 0.01ms 过渡，测试等待计算字号稳定后采样，未为测试修改生产动效。
- 生产与 Storybook 构建、Storybook 类型、相关 ESLint、tokens:check / typography:check 和 diff 检查通过。构建保留既有大 chunk 提示。桌面字号表、角色表和 390px 行高表已查看，计算行高的显示格式去掉浮点尾数，原始定义仍保留。
- 37 个 Foundations 索引条目及元数据一致；原 172 项 CSS token 的名称与声明值、28 项跨端基准、17 项所有权契约及 4 项上游输出保留，356 份 Apple 文件哈希一致。当前完整覆盖清单登记 279 项 CSS（其中 168 项非 adapter）、13 项运行时输出，新增 note-scale 用于统一阅读倍率。工程排版目录保留原 21 项原生表达式。
- 证据：`build/verification/typography-layers/` 的最终测试、构建、漂移检查日志、`final-preservation.json`、`final-ids.json` 和 `final-*.png`。此前同目录的 before/after metrics 只记录中间方案，不作为最终视觉完全一致的证据。本轮浏览器为 Chromium，未执行原生构建或真机 Dynamic Type 验收。

## Typography 文档字号单位展示（2026-10-21）

- 仅调整文档展示：Web 字号主值为浏览器在预览上下文中计算的 px，保留全部 33 项原始表达式及上游别名定义。基准同时显示当前根字号和 defaults.size 父级字号；组件局部绑定或缺少上下文的变量显示“随组件变化”，不以默认回退冒充真实组件值。笔记 size 选项及默认值补上 px，原四项跨端字号在独立原生表中显示 pt 基准，21 项原生规则表达式保留。
- 开发与静态 Docs 各六组回归通过（320 / 390 / 1368px × light / dark），核对原分区/锚点、全量定义、px 主值与实际样本字号一致、原始表达式、统一布局和无溢出。额外将根字号临时改为 20px：text-sm 显示 17.5px；父级仍为 16px 的 1.75em 保持 28px、0.85em 为 13.6px，11px 字面量保持 11px；局部变量不借用临时写入的全局 note-size。检查后恢复原值。
- 原四项 Typography Canvas 交互及四项字体样本单元测试通过；Storybook 类型、相关 ESLint、静态构建、typography:check、tokens:check 和 diff 检查通过。未修改生产源码、缩放规则或宽度公式；未执行生产/原生全量测试，也未将本轮文档验收等同于原生 Dynamic Type 真机验收。
- 293 份受保护文件哈希一致，包括全部 UI/Apple 生产源码、原故事、token 定义/registry/结构化及 Markdown 覆盖清单、使用目录和消费清单。37 个 Foundations 索引条目及元数据一致。已查看桌面字号表和 390px 原生基准表截图。
- 证据：`build/verification/typography-units/` 中的开发/静态、交互、单元、类型、lint、构建、目录/覆盖检查日志，保护哈希、前后索引及桌面/窄屏字号和原生表格截图。

## Typography 修复与字体样本按需加载（2026-10-21）

- 修复四项一致性问题：为提供真实斜体的字体注册 italic face，由浏览器在斜体文字出现时下载 WOFF2；缺少斜体的字体允许 style 合成，继续禁止 weight 合成。普通字形资源、默认字体/字号/字重、Typeset 层级与 Provider 宽度公式未改。等宽新选项和随机搭配只使用 Geist Mono / JetBrains Mono，读取和展示兼容旧的比例代码字体。行宽改用窄 / 适中 / 宽 / 宽松，保留旧存储档位、默认 720px 和全部原宽度映射。
- 使用目录递归追踪 CSS 和静态 CSS-in-JS 自定义属性绑定，保留变量名、原始表达式和作用域并防止循环；补上卡片 13px / 1.55、摘要及搜索预览等局部值。当前 88 项 Web 定义（18 字体栈、33 字号、10 字重、27 行高），原 21 项原生表达式和四项跨端字号保持完整。不把局部定义提升成新的全局 token。
- 字体样本在接近视口 160px 时逐行加载，屏幕外不绑定目标 font-family；每行等待对应样本文字的 FontFaceSet.load，字体文件或中文分片失败仅该行回退。取消聚合失败状态，卸载后断开观察并停止后续样本文字加载。冷启动实测 28 行中 27 行仍 idle，只有靠近视口的 Geist 行启动；本次首屏字体请求 16 次、响应体共 855268 字节（包含 Docs 自身所需的中文分片），未用整页滚动后的数据冒充首屏指标。
- 13 项设置/加载器/样本单元测试、6 项目录生成测试和原 15 项 token 测试通过。覆盖旧偏好兼容、新选择及随机搭配、四档宽度、正常/斜体去重、正常字体失败后重试、屏幕外不加载、单行失败隔离、中文分片失败不误报 ready、卸载清理和局部变量/别名/循环。原 Typography 四项 Canvas 交互测试通过。
- 开发与静态 Docs 各六组回归通过（320 / 390 / 1368px × light / dark），核对目录完整性、按需加载、两列排版、无横向溢出、锚点与 ID。真实浏览器截图验证默认 Noto Sans 的强调文字使用已加载的真实 italic face，普通字形切回后逐像素一致；两款 Mono 的 iiii / WWWW 宽度一致。卡片生产 CSS 夹具仍计算为 13px / 20.15px。
- 另选择运行六项现有字体回归：Button 390px 浅深色的延迟字体/离线回退，以及两项显式 Geist 字体选择，均通过；同文件另外 92 项本轮未执行。类型、相关 ESLint、生产构建、Storybook 静态构建、typography:check、tokens:check、设计清单与 diff 检查通过。构建仍有既存的大 chunk 提示，未扩展本轮范围进行拆包。
- 37 个 Foundations 索引条目及元数据完全一致。249 份保护文件中 248 份哈希一致，包括原故事、Provider、token 定义/registry/结构化覆盖清单及原生源码；Markdown 覆盖清单仅重新生成 Settings 去掉 ch 模板后不再误匹配的可能样式类依赖。172 静态 CSS 名称、12 运行时输出、28 可移植尺寸、17 所有权契约、105 个消费文件与两个原生消费文件均保留。
- 证据：`build/verification/typography-fixes/` 的单元、目录、交互、构建、字体、开发/静态回归日志，前后索引、保护哈希、冷加载测量和首屏截图；实际普通/斜体及全页截图由 `build/verification/foundation-reference/` 保留。本轮浏览器验证为 Chromium，未声明全平台字体字形、原生真机或生产/原生全量回归已验收。

## Typography 实际使用目录与展示整理（2026-10-21）

- Typography 仍只显示 Docs，原 Default / Compact Boundary / Spacious Boundary / Mobile Responsive 的 ID、test / mobile 标签和完整交互夹具未修改。保留 `#foundation-typography`，页面分为字体角色、可用字体、字号、字重、行高、笔记与跨端基准；原五个角色的定义与样本合并到两列表格。All tokens 仍为九个分区、134 项基础 CSS 定义与 28 项尺寸基准，没有加入重复的分类展示。
- 自动目录读取生产依赖图、实际 CSS 和锁定的 Tailwind 编译结果，当前 76 项 Web 定义（12 字体栈、30 字号、10 字重、24 行高），保留工具类/别名、媒体上下文和来源；`.875em` / `0.875em` 合并显示并保留原表达式记录。包含字重继承、字号附带行高、font 简写、arbitrary / slash / variant 工具类和 Mermaid 的 system-ui 字体参数；不纳入不可达的 LiveMarkdownEditor 或测试/故事。现有 28 个字体选项、笔记的 24 个字体可用范围、五个字体角色和四项排版偏好直接读取生产定义。
- 字体选项复用生产加载器；样本按实际字体栈渲染，系统字体和中文回退保持平台职责。字号样本消费原声明，em 和行高按 defaults.size 的同一基准对照；不将相对单位或局部变量提升成全局固定值。缺少局部绑定的变量明确标记上下文，零行盒不绘制误导性普通文字样本。字体、字号、字重及行高表共用两列、字号、边框与间距规则，现有三列偏好选项继续完整展示。
- 四项跨端字体尺寸保留原 px / pt 基准，另直接读取 21 项 SwiftUI font / fontWeight / lineSpacing 表达式，排除注释、字符串及现有 DEBUG-only 分支，保留生产 #else 和系统/条件表达式。未把系统文字角色或附加 pt 行距伪装成 CSS 字号/行高倍数；未修改 Swift 源码或 Dynamic Type。
- 生成器五项 Node 测试通过，覆盖工具类展开、字号/行高组合与变体、字重、局部声明、简写、静态内联/CSS-in-JS、动态字体引用登记、字面量排除、十进制排序与去重、原生嵌套表达式/DEBUG 分支、源文件可达性、稳定性和只读漂移。typography:check、tokens:check、十五项原 token 测试、设计清单、类型、相关 ESLint、静态构建和 diff 检查通过。
- 原 Typography 四项保存/恢复/边界/H5 测试，以及 All tokens / Spacing / Sizing 原场景共九项 Canvas 通过。最终开发与静态 Docs 各六组回归通过，覆盖 320 / 390 / 1368px × light / dark，核对六个分区、28 个字体选项与真实 CSS 栈、每项定义/样本的消费一致性、默认字号、四项跨端基准、21 项原生规则、无溢出、统一表格、旧锚点和隐藏 ID。已人工查看桌面浅色、字号/行高分区及窄屏字体/字号/原生表格截图。
- 254 份受保护文件哈希一致，包括 UI 生产源码、原 Typography / Spacing 故事、token 规范/定义/registry/覆盖清单、Spacing 使用目录及隔离解析器；37 个 Foundations 索引条目及元数据一致，Swift 源码 diff 为空。未改变生产外观、偏好、交互或排版规则。本轮未执行生产/原生全量验收或全平台字体字形验收，未提交或发布。证据为 `build/verification/typography-catalog/`，包含生成、构建、类型、lint、Node / Canvas / 开发 / 静态测试、前后索引、保护哈希与六张最终 Typography 页面截图。

## Spacing 横向标尺展示（2026-10-21）

- 参考用户提供的 Astryx 截图，将 Spacing 的 Web 与跨端分区统一为 Token / Value 两列；Value 内并排展示灰色横条和既有数值。横条左端一致，条与文字垂直居中，宽度对应实际间距；零档保留 0px 宽度，以 1px 伪元素标记原点。只借鉴展示样式，仍使用项目 muted-foreground 和圆角设置，没有引入 Astryx token 或更改单位、上游表达式及六项跨端基准。
- 既有预览测量改为检查横条宽度，并增加两列结构、共同起点、8px 条高、8px 文本间隔与垂直居中检查；原有根字号 20px / 恢复 16px 的 rem 响应、跨端固定尺寸、九页定义完整性、隐藏故事 ID、锚点和无溢出断言继续通过。开发与静态 Docs 各六组回归通过，覆盖 320 / 390 / 1368px × light / dark，已人工查看窄屏浅色及桌面深色截图。
- 原有 Spacing / All tokens / Sizing Canvas 共五项、新间距生成器三项、spacing:check、tokens:check、类型、相关 ESLint、静态构建与 diff 检查通过。252 份受保护文件（生产源码、原 Spacing 故事、token 规范/定义、完整覆盖清单及间距使用目录）哈希不变，37 个 Foundations 索引条目及元数据不变。未改生产外观、交互及规则，未执行生产/原生全量验收，未提交或发布。证据与六张页面截图位于 `build/verification/spacing-bars/`。

## Spacing 上游标尺与跨端基准（2026-10-21）

- Spacing Docs 分为 Web 间距标尺、跨端间距基准。保留原 `#foundation-spacing`，新增 `#foundation-spacing-web`；只在分类页展示上游使用档位，All tokens 的 9 个分区、134 项基础 CSS 定义和 28 项尺寸基准保持不变。导航仍仅有 Docs，旧 `foundations-spacing--reference` ID、隐藏标签及测试保留。
- 使用生产依赖图与锁定的 Tailwind 4.3.3 编译器生成使用清单，当前 16 个标尺档位、128 条间距工具类。上游 `--spacing: 0.25rem` 和每档表达式均直接读取或编译，包含半档，排除尺寸/定位类；auto、局部任意值和安全区记录消费者但不提升为标尺。负边距沿用对应标尺幅度，原工具类保留负号。六项跨端基准仍读原生成 token，保持 4 / 8 / 12 / 16 / 24 / 32px 或 pt。
- 预览改为两个元素之间的真实空隙，列内竖向起点对齐；Web 数值随实际 rem 计算及 ResizeObserver 更新。回归额外将根字号改为 20px，确认 Web 16 档变为 80px、恢复后回到 64px，而跨端 px 基准不变。320px 下调整基准表列宽，token 名称保持完整，页面及表格无横向溢出；截图已人工查看。
- 新生成器三项 Node 测试通过，覆盖有效候选、变体/负边距/important、模板静态部分、CSS @apply、注释/类型/导入与不完整拼接排除、非标尺值登记、动态档位、稳定性及只读漂移检查。spacing:check、原 token 检查与十五项测试、设计清单、类型、相关 ESLint、静态构建和 diff 检查通过。原有 Spacing / All tokens / Sizing Canvas 共五项通过；最终开发与静态 Docs 各六项回归通过，覆盖 320 / 390 / 1368px × light / dark，并继续执行九页排版、定义、锚点及隐藏旧 ID 检查。
- 本轮前后 251 份生产源码、原 Spacing 故事、token 定义、规范、registry 和完整覆盖清单哈希一致；37 个 Foundations 索引条目及元数据完全一致。未改变生产样式、交互或跨端规则。本次未执行生产/原生全量验收，未提交或发布。证据为 `build/verification/spacing-scale/`，包含构建、测试、保护哈希、前后索引和六张 Spacing 页面截图；维护范围见 token-engineering.md。

## Foundations 全面审查（2026-10-21）

九个 Docs 页面与 Color Diagnostics 已检查。总览与分类共用同一份定义是正常引用；按名称检查单页唯一性，不将相同色值、跨层别名或总览/分类引用判为重复定义。分类定义合计完整覆盖总览的 134 项非适配层 CSS 定义与 28 项尺寸基准。

| 页面 | 核对的展示范围 |
| --- | --- |
| All tokens | 134 项基础 CSS 定义、28 项尺寸基准，每个名称恰好一次 |
| Color | 114 项颜色角色，含标签、标注与配色标尺 |
| Elevation | 6 项项目定义、16 档上游阴影标尺 |
| Shape | 9 项 CSS 角色、7 档固定圆角及原派生表达式 |
| Spacing | 6 项基准与原尺寸预览 |
| Typography | 5 项字体角色、对应的 5 个真实变量样本、4 项原有尺寸/排版偏好 |
| Size & density | 15 项侧栏尺寸、4 个生产按钮尺寸 |
| Icons | 82 个生产代码使用的标准图标名称与可解码 SVG |
| Motion | 7 组现有场景的时长/缓动、4 组减少动态效果规则、1 处手动演示 |
| Color Diagnostics | 22 组配对、既有判定结果与可键盘访问的内部横滚表格 |

- 修复 Icons / Motion 的正文标题与页标题重复，改为「项目图标」「动效规范」；补齐 Typography 缺少的笔记标题字体样本，并逐个验证五个样本确实消费所标记的字体变量。Elevation 页与总览移除已不再展示的焦点示例文案，名称和说明与当前阴影/透明度内容一致；既有 ring 颜色和组件焦点契约仍保留在原归属。
- 九个 Docs 共用同一模板。页面回归新增 h1/h2/h3 唯一性、单页定义唯一性、目录与标题锚点均指向本页且目标存在、分区标签有效、表格无嵌套、表头/单元格字体与边距/垂直对齐一致、各页主标题样式一致、表格内部无裁切与页面无横向溢出检查。原 ID、测试、分类入口和已隐藏场景全部保留；没有重新加入工程维护表、重复交互示例或测试跳转。Diagnostics 保留其诊断专用四列表格及原测量逻辑。
- All tokens 与分类逐名对照生成目录，当前展示范围没有重复定义或遗漏。完整 registry / 覆盖清单仍包含全部 172 项静态 CSS 定义、12 项运行时输出、28 项可移植尺寸、17 项所有权契约和 4 项上游输出；38 项适配层及运行时/所有权信息继续在工程文档与完整清单中，不为缩短页面裁剪定义，也不重新混入总览主表。16 档 Tailwind 上游阴影、图标目录与只读动效场景不伪装成新的项目 token。
- 先新增逐页审查断言并复现标题重复失败，再完成修复。最终开发与静态页面各六项回归全部通过，覆盖 320 / 390 / 1368px × light / dark（含 mono / blue）、所有九个 Docs 与 Diagnostics、七档圆角切换、真实 Sheet 动效及减少动态效果。原有 Foundations 与相关 Callout / 项目阴影故事共 32 项通过；token 测试 15 项、图标测试 8 项通过。类型、相关 ESLint、构建、tokens:check、icons:check、设计清单、消费映射与 diff 检查通过。
- Foundations 的 37 个索引项（含 ID、名称、测试/设备/隐藏标签等元数据）前后完全一致；261 份生产源码、规范、定义、registry、覆盖清单、生成值和旧故事/夹具文件哈希一致。仅修改共享 Storybook 展示、只读说明和新增审查断言，生产圆角、颜色、字体、尺寸、交互与动效规则均未改。既有蓝色 primary 对比度与容器配对诊断结果继续保留；本轮不是全字体/全配色无障碍认证或原生全量验收。
- 证据在 `build/verification/foundations-audit/`；页面截图在 `build/verification/foundation-reference/`。Storybook 保持运行，未提交或发布。

## Spacing / Typography / Size & density 整理与加载恢复（2026-10-21）

- 三个分类侧栏均只显示 Docs。Spacing / Sizing 的 Reference，以及 Typography 的 Default / Compact Boundary / Spacious Boundary / Mobile Responsive 使用 !dev 隐藏；全部六个原 ID、test 标签和原 mobile 标签保留，没有重命名故事或删除夹具。Typography 文件剔除新增隐藏标签后与本轮基线逐字一致，原保存、边界选择、恢复默认、390×844 和代码内部横滚断言未改。
- 间距六项、侧栏尺寸十五项均保留，统一为 Token / Value / Preview 三列；按钮四个尺寸从并排示例改为同列对齐的生产 Button 表格。Typography 保留四行字体样本、全部五个静态角色和四项现有尺寸/排版偏好，移除指向隐藏测试故事的跳转及其孤立样式，使用简短分区标题。px / pt、按钮高度、字体回退和运行时偏好规则不变。
- 原相关故事测试六项全部通过，包括三个桌面 Typography 场景、一个移动 Typography 场景和两个 Reference。开发与静态页面各六项回归通过，覆盖 320 / 390 / 1368px × light / dark：检查 Docs 单入口、六个旧 ID 测试资格、旧 Reference 直接加载、完整名称清单、全部基准的原尺寸、四个按钮真实高度 24 / 32 / 36 / 40px、字体角色及默认偏好、无隐藏测试跳转和无页面横向溢出。
- 用户反馈动态模块加载失败时，当前 6006 已无服务监听，HTTP 请求返回 000；未确认此前进程退出原因。恢复 Storybook 后，原带时间戳的 spacing 模块 URL 返回 200，用户当前浏览器重新加载并切换 Spacing Docs 后正常显示；原 Reference ID 也经浏览器回归和 Canvas 检查可加载。服务保持运行，没有加入吞错或自动重试逻辑。
- 类型、相关 ESLint、静态构建、tokens:check 和 diff 检查通过；十六份定义、规范、registry、覆盖清单、生成值、采样器、Typography 偏好/Provider/Typeset 与 Button 源码/尺寸数据哈希保持一致。证据在 `build/verification/foundation-docs-cleanup/`，三页截图为 `build/verification/foundation-reference/{spacing,typography,sizing}-docs-{width}-{theme}.png`，用户浏览器恢复截图为 spacing-recovered.png。本轮未重跑生产或原生全量验收，未提交或发布。

## Shape 分区、公式与预览整理（2026-10-21）

- Shape 仅保留 Docs，`foundations-shape--reference` 使用 !dev 隐藏，原 ID 和 test 标签保留；原 Reference Canvas 测试一项通过。页面分为「圆角选项」和「当前主题圆角」，保留原 foundation-shape 锚点并增加当前主题分区锚点，删除重复的 Shape tokens 标题。
- 七个固定档位和九个 CSS 角色均完整展示，两表统一为 Token / Value / Preview。主题角色按 sm 到 4xl 排序，交互区域角色在第二表内单独分组。当前 --radius 基准与源码声明中的表达式一起展示；公式直接读生成目录，不复制平行规则。预览桌面为 64×56px，窄屏为 56×48px；预览列、表头与两表纵向位置保持一致。
- 最终开发页面六项回归、静态页面六项回归均通过，覆盖 320 / 390 / 1368px × light / dark。检查仅 Docs 可见、旧 ID 测试资格、两个分区锚点、三列表头、全部七档和九个角色、公式与权威声明一致、放大预览尺寸、列对齐及无横向溢出。实际工具栏逐一切换七档，验证固定基准不变、七个主题角色的原始计算规则和预览一致；none 下 --radius-xl 仍为 4px，交互区域默认值仍为 8px / 4px。
- 首轮切换断言曾在已有极短样式过渡完成前读取预览，已等待实际计算值稳定，不改生产过渡。开发服务与构建并行期间出现导航中断；最终在构建完成后验证，开发与静态全部通过。类型、相关 ESLint、静态构建、tokens:check 和 diff 检查通过；十一份规范、定义、registry、覆盖清单、生成尺寸与采样器文件哈希保持一致。
- 证据在 `build/verification/shape-docs/`，截图为 `build/verification/foundation-reference/shape-docs-{width}-{theme}.png` 和 shape-sidebar.png。仅调整文档与 Storybook 展示、导航和页面回归；未改生产圆角、交互，未重跑生产或原生全量验收，未提交或发布。

## Motion Docs 规范与嵌入演示（2026-10-21）

- Motion 侧栏仅保留 Docs，Reference / Reduced Motion 的原 ID、test 标签和旧回归保留并隐藏。删除仅说明与跳转的展示方式，统一表格列出默认过渡、快速记录、抽屉进入/退出、侧栏展开/收起、手势回弹、图片加载共七组时长/缓动及来源，直接读取当前生产源码与已安装 Tailwind；缺少定义会明确失败，不复制成新的全局 token。
- 补充四组减少动态效果规则，直接读取全局 0.01ms / auto 和组件的 none 策略。Docs 嵌入一处真实 Sheet 演示，只显示系统偏好和「播放动效」按钮；沿用 MotionExample 的默认完整夹具，通过 compact 变体去掉工程说明与开关状态。旧 inspectSheet / inspectReducedMotion 测试辅助函数逐字保持一致，具体抽屉交互展示仍在 Sheet。
- 原相关 Canvas 九项全部通过。开发与静态页面各六项回归通过，覆盖 320 / 390 / 1368px × light / dark：检查单入口、旧 ID 测试资格、七组时长与表格来源、四组规则、无旧跳转链接、一处嵌入演示及无溢出。每种宽度/主题都真实切换浏览器 no-preference / reduce，生产 Sheet 的动画与过渡分别为 200ms / 0.01ms，并核对缓动与规范表一致；未模拟 CSS 或修改生产媒体规则。
- 首轮 Docs 检查在模态打开后通过无障碍角色定位读取背景表格，背景被正确隐藏导致等待；已将表格读取前移，单项冒烟及最终全部回归通过。类型、相关 ESLint、静态构建、token 生成物和 diff 检查通过；十份 token 定义、规范、registry 与覆盖清单哈希保持一致，未改生产样式或交互。
- 日志与基线在 `build/verification/motion-docs/`，截图为 `build/verification/foundation-reference/motion-docs-{width}-{theme}.png` 和 motion-sidebar.png。本轮仅调整 Storybook 与维护说明，未重跑生产或原生全量验收，未提交或发布。

## Icons 生产使用目录与导航精简（2026-10-21）

- Icons 侧栏仅保留 Docs，`foundations-icons--reference` 保留原 ID 和测试并隐藏导航。原来的十个原生侧栏资产预览改为自动生成的项目 Lucide 使用目录，目前 82 个标准名称，网格仅显示图形与名称；原生桥接、16 / 44px 侧栏基准和导出流程移到 token-engineering.md。
- 新生成器复用生产依赖图与 TypeScript 符号绑定，排除测试/故事/不可达文件、未使用导入、类型、注释/字符串及局部同名遮蔽，合并 XIcon / X、MoreHorizontal / Ellipsis 等别名；原生侧栏复用原生成器的十项映射，并与 Web 目录去重。生成 JSON 包含标准名称、SVG 与消费者，不导入完整 Lucide 图标库到页面。清单是生产可达模块的静态运行时引用范围，不模拟全部局部死代码裁剪或单一页面渲染状态。
- icons:build / icons:check 同时维护原生资产与新目录；Storybook 启动和构建自动生成，开发中变更生产导入后可重新运行生成刷新。旧原生导出函数及资源逻辑不变，仅共享映射。生成器在内容不变时保留 mtime，检查漂移时不覆盖源文件；遇到不支持的 Lucide namespace / 动态导入 / 直接再导出会明确失败。
- 原生与新目录 Node 测试八项通过，覆盖导出元数据、稳定性、漂移、符号绑定、别名、排除范围和消费者可达性；保留的 Reference 与 effects Canvas 共五项通过，原十项 SVG 资源加载/几何检查仍执行。开发与静态页面各六项回归通过，覆盖三档宽度 × light / dark，检查 82 个名称完整且有序、每个 SVG 可解码为 24px、currentColor 前景继承、维护信息缺席、无溢出和 Docs 单入口。
- 类型、相关 ESLint、静态构建、icons:check、token 检查、设计清单与 diff 检查通过；十份 token 定义、规范、registry 和完整覆盖清单哈希与本轮开始一致。类型检查曾发现共享尺寸表仍需 sidebarTokens 导入，已恢复该引用后通过；只改变 Storybook 展示与生成流程，未改生产界面及原生资产。证据在 `build/verification/project-icons/`，截图为 `build/verification/foundation-reference/project-icons-{width}-{theme}.png` 和 icons-sidebar.png。未重跑生产或原生全量验收，未提交或发布。

## Elevation 仅保留 Docs，检查归入 Sheet / Motion（2026-10-21）

- Elevation 的 default / dark / reduced-motion / regression 均隐藏导航，Docs 成为唯一可见入口；原四个 ID 和 test 标签保留。抽屉交互的可见入口为 `components-sheet--interaction`，动效媒体偏好为 `foundations-motion--reduced-motion`，Motion Docs 链接改指向本分类入口。
- 抽屉夹具与完整键盘/遮罩/关闭断言提取到 sheet-check.example.tsx；MotionExample、Sheet 时长/焦点检查与媒体模拟断言提取到 foundation-motion.example.tsx。旧 ID 与新分类共用实现，未裁剪原断言；旧 Regression / Dark 的图标、静态阴影、独立焦点检查保留。对比提取前源码，原夹具及 play 主体除缩进外一致。
- 相关 Canvas 九项全部通过，包括四个保留的 Elevation 场景、原 Sheet 右侧/H5 底部场景、新 Sheet 交互入口、Motion Reference 与新动效入口。开发与静态页面各六项回归通过，核对 Elevation 仅一个 Docs 链接、所有旧 ID 隐藏且可测试、新入口的分类/可见标签、Motion 文档链接，以及 Sheet 交互在三档宽度、浅深模式下的键盘可达、边界、两种关闭方式与焦点返回。
- 类型、相关 ESLint、静态构建、生成物及 diff 检查通过；十份 token 定义、registry、规范和完整覆盖清单的哈希与本轮开始一致，未改生产组件、样式与消费者。证据在 `build/verification/elevation-ownership/`：definition-hashes-before.json、effects.before.tsx、preservation.json 及 canvas / dev / static / types / lint / build / tokens-check 日志。更新侧栏截图为 `build/verification/foundation-reference/elevation-sidebar.png`。未重跑生产或原生全量验收，未提交或发布。

## Elevation Diagnostics 仅保留真实抽屉（2026-10-21）

- 可见 Diagnostics 仅保留「浮层检查」标题与「打开抽屉」按钮，使用生产 Sheet；抽屉内仅有标题、必要的操作提示和原关闭按钮。移除该页的图标网格、静态阴影、独立焦点按钮、媒体偏好/开关状态与工程说明，侧栏仍只有 Docs / Diagnostics，原 default / dark / reduced-motion ID 保留。
- 原 Effects / MotionExample 夹具与原默认、减少动态效果的 play 主体逐字比较保持一致；原默认断言转入隐藏 Regression，Dark 沿用完整夹具和断言，Reduced Motion 显式渲染原夹具。四项 Canvas 测试通过：保留原三组完整资源、阴影、焦点、Sheet 与媒体偏好检查，新增精简页面的键盘进入、遮罩、Esc / 按钮关闭及焦点返回检查。初次断言在动画初始帧检查遮罩过早，改为等待真实可见状态，未改生产过渡或样式。
- 开发服务和静态页面各六项回归通过，覆盖 320 / 390 / 1368px × light / dark（390px 使用 none 圆角），确认页面仅一个标题和一个按钮、无重复内容、抽屉进入后的边界、两种关闭方式及焦点恢复；同时检查隐藏 Regression 保留测试资格、原 token 全量展示和侧栏入口。边界断言等待真实进入动画完成，不使用固定延时或改变系统媒体设置来规避检查。
- 类型、相关 ESLint、静态 Storybook 构建、token 生成物检查与 diff 检查通过。十份定义、registry、规范和覆盖清单的哈希与本轮开始完全一致，未修改生产消费者。证据为 `build/verification/elevation-diagnostics/` 中的 before 源码、preservation.json、definition-hashes-before.json 和 canvas / dev / static / types / lint / build / tokens-check 日志；截图为 `build/verification/foundation-reference/elevation-diagnostics-{width}-{theme}.png`。本轮仅修改 Storybook、相应回归及展示维护说明，未重跑生产或原生全量验收，未提交或发布。

## Elevation 侧栏入口精简（2026-10-21）

- 侧栏仅保留 Docs 与 Diagnostics；原 Default 只修改展示名，保留 `foundations-effects--default`。Dark 与 Reduced Motion 使用 `!dev` 隐藏，原主题参数、ID、测试资格和全部 play 断言不变。明暗模式继续使用工具栏；Motion Docs 的 Reduced Motion 直达链接仍保留。
- 原有三个 Canvas 测试全部通过，覆盖资源、阴影、Tab 焦点、生产 Sheet 打开/关闭、焦点恢复与真实减少动态效果媒体偏好。开发服务和静态页面各六项 Docs 回归通过，新增索引及真实侧栏检查，确认两个可见入口和三个原有测试 ID；既有 token 值、布局与导航检查继续通过。类型、相关 ESLint、静态构建与 diff 检查通过。
- 日志为 `build/verification/elevation-navigation/{canvas,dev,static,types,lint,build}.log`，侧栏截图为 `build/verification/foundation-reference/elevation-sidebar.png`。仅修改 Storybook 导航元数据、回归和维护文档，生产定义、消费者及交互未改；未重新执行生产或原生全量验收，未提交或发布。

## 项目阴影 token 提取与消费（2026-10-21）

- 对比已安装 Tailwind 标尺与既有 overlay-shadow 后，四组局部阴影没有数值完全相同的现成档位；保留原值，新增 surface-shadow、surface-focus-shadow、control-shadow、floating-control-shadow。快速记录、加载占位与笔记卡片共享表面角色，继续页面与移动导航/关闭按钮共享轻量控件角色。已有 shadow-lg、shadow-none 和浮层角色不变，混合状态下划线不归入 Elevation。
- 共享的两个固定角色放在 theme/tokens.css；快速记录专用的两个模式角色放在 theme/capture.tokens.css，随 quick-capture.css 加载。删除迁移后冗余的暗色阴影规则，保留暗色描边、原焦点条件、Ring 组合、过渡与 Reduce Motion。更新 App 既有卡片 class 断言，避免测试中的旧类继续生成闲置 CSS。未修改打包预算。
- registry、规范、逐项消费映射与自动清单同步：172 项静态 CSS、134 项非适配层定义、12 项运行时输出、28 项尺寸、17 项契约；索引覆盖 105 个 Web 源文件（含新增定义文件）与两个原生文件。All tokens 和 Elevation 自动纳入四个角色，沿用统一表头、64×40 预览和当前模式取值。
- 提取前浅深色基线两项通过；提取后浏览器 13 项通过，包括两个隐藏阴影场景、原 QuickCapture 八项及 effects 三项。阴影场景使用独立旧值核对快速记录、六张加载卡片、输入占位、导航按钮、悬浮入口、聚焦表面、Sheet 继续/关闭按钮，并覆盖四个变量证明实际消费。保留 Sheet 关闭和焦点交互。
- App / QuickCapture / NoteCollection 共 117 项测试、token 15 项测试、类型、相关 ESLint、设计清单和生成物检查通过。静态 Docs 与开发服务各六项通过，覆盖 320 / 390 / 1368px × light / dark；核对全部 21 个阴影预览的取值、布局和无溢出。静态页面的项目值按实际构建后 CSS 比较，兼容构建器将颜色规范化为十六进制；生产原值另由独立基线验证。
- 首次将所有角色加入主题入口后触发首屏 CSS 预算，已通过移除旧测试类并按组件加载专用定义解决。最终初始 CSS 97,197 bytes（上限 97,280），首屏 190,721 bytes gzip，所有原有路由预算通过。证据保存在 `build/verification/project-shadows/`，含提取前源码、before-browser / after-browser、component-tests、token-tests、docs-static / docs-dev、production-build / bundle 日志。仅验证上述范围，未重跑全部 Web / 原生设备验收，未提交或发布。

## Elevation 补齐内阴影与轮廓投影（2026-10-21）

- 直接从安装的 Tailwind theme.css 读取三档 inset-shadow 和六档 drop-shadow，与既有七档外阴影分组展示。统一使用相同表头、列宽、字号、间距和 64×40 预览框；内阴影使用真实 box-shadow，轮廓投影使用透明 SVG 的 filter: drop-shadow，未额外添加矩形底色或模拟描边。项目定义、生产消费者及 All tokens 范围不变。
- 开发服务与最终静态页面各六项 Docs 回归通过，覆盖 320 / 390 / 1368px × light / dark；核对全部 16 个上游名称与原值、box-shadow / filter 的真实计算结果、六个透明 SVG、全部 17 个预览的列位置和尺寸，以及无溢出。类型、相关 ESLint、静态构建及 diff 检查通过。
- 日志为 `build/verification/foundation-reference/shadow-families-{dev,build,static}.log`；截图为同目录 `inset-shadow-scale-{width}-{theme}.png`、`drop-shadow-scale-{width}-{theme}.png` 与更新的完整 Elevation 截图。仅修改 Storybook 和文档，未重跑生产或原生业务验收，未发布。

## Elevation 移除焦点示例与跳转链接（2026-10-21）

- 仅从 Elevation Docs 移除焦点按钮、说明与“查看生产浮层与焦点检查”链接，并清理相应文档样式。基础阴影、项目定义与预览保留；生产定义、组件及原 Default / Dark / Reduced Motion 场景和断言未修改。
- 原有三项 Canvas 回归通过，保留图标资源、浮层阴影、Tab 焦点、Sheet 关闭/焦点恢复及减少动态效果检查。静态 Docs 六项通过，新增焦点区和链接缺席检查，原阴影值、表格对齐及无溢出检查继续保留。类型、相关 ESLint、静态构建与 diff 检查通过。
- 日志为 `build/verification/foundation-reference/remove-focus-{canvas,build,static}.log`。仅修改 Storybook 与文档，未重跑生产或原生业务验收，未发布。

## Elevation 阴影表排版统一（2026-10-21）

- 基础阴影和项目阴影共用 ShadowValue，统一表头为当前模式的 `Value · light / dark`，沿用同一列宽、字号、间距与 64×40 预览。桌面数值换行时预览仍在同列，窄屏统一将预览放在值下方；All tokens 的项目阴影也使用相同展示组件。上游数值、项目定义和生产消费者不变。
- 最终静态页面和开发服务各六项回归通过，覆盖三档宽度与亮暗模式；核对两表表头、八个预览的列位置和尺寸、原有七档真实计算阴影与无溢出。类型、相关 ESLint、静态构建和 diff 检查通过。首轮开发检查有一次 All tokens 空白页面计数失败，未修改断言，重新执行六项通过；未认定瞬时空白的原因已查明。
- 证据为 `build/verification/foundation-reference/elevation-layout-{dev,dev-final,build,static}.log` 及 `elevation-layout-{width}-{theme}.png`。仅修改 Storybook 展示与验证记录，未重新运行生产或原生业务验收，未发布。

## Elevation 增加七档上游阴影（2026-10-21）

- Elevation 分类页新增基础阴影表，按 2xs / xs / sm / md / lg / xl / 2xl 顺序展示 token 名称、原始值及预览。数据直接来自安装的 Tailwind `theme.css`，不复制数值或增加生产定义；项目原有定义、示例和组件用法保留。桌面预览纵向对齐，窄屏预览在值下方排列。
- 开发服务与最终静态页面各六项 Docs 回归通过，覆盖 320 / 390 / 1368px × light / dark；逐项核对七个名称、与上游文件一致的值、预览真实计算阴影和无横向溢出。类型、相关 ESLint、静态构建与 diff 检查通过。
- 证据为 `build/verification/foundation-reference/shadow-scale-{dev,build,static}.log` 和同目录 `shadow-scale-{width}-{theme}.png`。本轮仅修改 Storybook 和文档，未重跑生产或原生业务验收，未发布。

## 标注文字与菜单色样 token 化（2026-10-21）

- 在 `import-layout.tokens.css` 新增九个 `--callout-text-*` 和九个 `--callout-swatch-*`，原浅深色文字与菜单固定色相分别原样提取；默认文字/样本仍使用 foreground，默认背景仍透明。正文与标题继承、菜单文字/背景两组样本分别消费对应角色，选项值、数据属性和保存格式不变。九条暗色文字规则在提取后与基础规则完全相同，合并为通过 token 覆盖模式的基础规则。
- 补齐两个 registry 族、语义定义与消费者说明，更新完整 Markdown/JSON 清单和 Storybook Callout colors 展示。现为 168 项静态公开 CSS 名称（149 项颜色相关）、12 项运行时输出、28 项可移植尺寸、17 项所有权契约；生产消费索引仍覆盖 104 个 Web 文件、两个原生文件。旧标注背景的 18 条浅深色声明逐项保持一致。
- 生产修改前新增真实 RichMarkdownEditor / CalloutColorsMenu 浏览器基线，浅深色两项通过；修改后仍逐项核对 10 种文字状态及标题继承、20 个菜单样本的原始色值和背景。另覆盖全部 18 个新变量，确认正文与菜单实际响应各自 token，并在 finally 恢复。选色、独立背景、恢复默认、菜单关闭、图标与正文保留继续检查；隐藏场景不增加导航或 Docs 入口。
- `tokens:check` 与 15 项 token 测试通过，包含两组完整九色定义、浅深色声明数与生产消费者索引检查。最终颜色/标注浏览器场景 13 项通过（一个文件按原 mobile 筛选跳过），RichMarkdownEditor 与 Markdown 既有回归 184 项通过，覆盖选择、重置、撤销、序列化和重开。静态 Docs 六项通过，检查新定义展示、侧栏入口与测试隐藏状态；类型、相关 ESLint、设计清单、静态构建及 diff 检查通过。
- 首次生产包预算检查的一条移动端路由超出 raw 上限 589 字节；合并重复暗色规则后所有原预算通过，未放宽门槛。最终首屏为 190,785 bytes gzip。保留既有大 chunk 与 jsdom scrollBy 提示。本轮未执行 Web 全量、Safari / 原生设备或全页无障碍验收，未提交或发布。
- 日志和提取前源码保存在 `build/verification/callout-tokens/`：`before-browser.log`、`final-browser.log`、`editor-tests.log`、`final-token-check.log`、`final-docs-static.log`、`final-storybook-build.log` 与 `production-build.log`。色值检查是浏览器 CSS 解析结果，未将其表述为全页像素比对或全部配色的对比度合规。

## Diagnostics 移除交互状态展示（2026-10-21）

- Diagnostics 删除整个交互状态区，仅保留主题摘要和 22 组配对结果。生产 Button / Input / Tabs 夹具及原交互断言完整迁至五个隐藏 State Regression 场景，沿用默认、Dark、Blue Slate、Dark Teal、Mobile 组合；原有六个颜色场景 ID 和测试资格保留。
- 颜色 Canvas 11 项全部通过，包含六个原有颜色场景与五个迁出的交互场景。静态页面六项回归通过，覆盖 320 / 390 / 1368px × light / dark，检查交互区及控件缺席、颜色结果仍完整、五个新场景可测试且无导航入口，侧栏仍仅 Docs / Diagnostics。索引检查发现展开对象不会自动继承隐藏标签，已在每个导出显式声明 `!dev` 后通过检查。
- 类型、相关 ESLint、静态构建与 diff 检查通过；八份定义、registry、完整清单的哈希与原基线一致。日志为 `build/verification/foundation-reference/remove-states-{canvas,build,static}.log`。未重跑 Web / 原生全量业务验收，未发布。

## Diagnostics 交互状态布局（2026-10-21）

- 「真实组件状态」改为「交互状态」，删除说明段落、外层边框与内边距；按钮、输入、Tabs 三组在桌面并排、窄屏纵向排列。按钮文案缩短为「可操作」「不可用」，生产控件、状态、受控输入、错误描述关联与 Tab 顺序保持一致。
- 原有六个颜色场景全部通过，保留真实悬停、键盘焦点、禁用样式、输入编辑、错误边框及 Tabs 键盘切换断言，仅更新标题和按钮文案定位。开发服务与最终静态页面各六项检查通过，覆盖 320 / 390 / 1368px × light / dark，并检查三组布局和页面无横向溢出。类型、相关 ESLint、静态构建与 diff 检查通过。
- 日志为 `build/verification/foundation-reference/interaction-states-{canvas,dev,build,static}.log`；分组截图为同目录 `interaction-states-{width}-{theme}.png`。本轮仅调整 Storybook 展示和对应文档，未重新运行完整 Web / 原生业务验收，未发布。

## Color Diagnostics 内容精简（2026-10-21）

- 页面收敛为主题摘要、配对结果表、真实组件状态三部分。22 组配对统一为配对 / 样本 / 对比度 / 结论四列，九组标签合并展示；移除重复色板、长篇测量说明和源码路径。工程信息移到 [颜色诊断方法与维护](token-engineering.md#颜色诊断方法与维护)，两项特殊判定范围仍随结果说明。
- 35 个颜色角色改为隐藏测试夹具，逐项检查变量和浏览器实际解析色，并在测试后清理；原有 22 组比值、已知问题、原生 palette 和 Button / Input / Tabs 交互检查继续保留。六个颜色场景的 ID、导航隐藏规则与测试资格均不变。
- 新增深色蓝色组合复核，确认 primary 的既有文字对比度问题在浅、深两种模式下均约为 3.76:1；修正原来仅列浅色的测试预期，同时断言实际主题、配色和原始比值，未改变生产颜色。浅色 muted 容器约为 4.46:1，继续单列诊断，未作为文字 AA 失败或通过。
- 开发服务与静态构建各六项真实页面检查通过，覆盖 320 / 390 / 1368px × light / dark，含蓝色配色、22 行四列、已知未达标项、真实组件区和页面无横向溢出；窄屏表格保留局部横向滚动与键盘焦点。全部 Foundations Canvas 21 项通过（12 个文件通过、六个按原配置跳过），类型、相关 ESLint、静态构建与 diff 检查通过。
- 八份生产定义、registry 与完整生成清单的 SHA-256 与精简前基线逐项相同，新增文档的本地链接检查通过。证据为 `build/verification/foundation-reference/diagnostics-{dev,build,static,foundations}.log` 和同目录 `diagnostics-*.png`。本轮仅修改 Storybook 和文档，未重跑完整 Web / 原生业务验收，未触发远程 CI、安装或发布。

## Color 侧栏保留 Docs 与 Diagnostics（2026-10-21）

- Default 仅修改展示名称为 Diagnostics，保留 `foundations-colors--default`。Dark / Blue Slate / Dark Teal / Mobile / Live Palette 使用 `!dev` 隐藏导航；原导出、story ID、场景参数、移动端标签及 play 断言均保留。隐藏变体显式保留各自名称，避免继承 Diagnostics 展示名。
- 索引回归检查原有六个 story ID 均保留测试资格，隐藏的五个场景无 dev 标签；真实 Color 侧栏严格只有 Docs 和 Diagnostics 两个入口。开发服务与最终静态页面各六项 Docs 检查通过，原 Foundations Canvas 21 项全部通过；类型、相关 ESLint、静态构建与 diff 检查通过。
- 定义、registry 与覆盖清单八份文件哈希未变。日志为 `build/verification/foundation-reference/colors-nav-{dev,build,static,canvas}.log`，截图为同目录 `sidebar-foundations.png`。本轮未重跑完整设计门禁或 Web / 原生业务验收。

## All tokens 侧栏入口精简（2026-10-21）

- All tokens 仅显示直接打开 Docs 的入口；Default / Dark / Mobile 以既有 `!dev` 标签隐藏导航，保留原 story ID、`test` 标签及全部断言。LiveThemeExample 与 LivePalette 的真实 Provider 交互和 palette 同步断言原样移入 Color 分类，入口为 `foundations-colors--live-palette`，消费映射同步更新。
- 真实 manager 回归检查三个隐藏故事仍在索引且可测试、侧栏无重复入口、All tokens Docs 可见；Color 分类中 Live Palette 可见且 Color Docs 正常打开。开发服务与最终静态页面各六项 Docs 回归通过，全部 Foundations Canvas 仍为 21/21，通过的场景数量未因隐藏入口减少；类型、相关 ESLint、静态构建和 diff 检查通过。
- 八份定义、registry 和完整覆盖清单的哈希保持不变。日志在 `build/verification/foundation-reference/sidebar-{dev,build,static,canvas}.log`，截图为同目录 `sidebar-foundations.png`。本轮未重跑完整设计门禁或 Web / 原生业务验收。

## Foundations 展示圆角跟随主题（2026-10-21）

- 将表格、色块、字体/焦点展示容器的固定圆角改为现有 `--radius`；移动端色块不再单独覆盖 7px。链接焦点与尺寸条的圆角随同一基准派生，`none` 时均为直角。固定 radius 基准样本继续展示各自定义，未改动生产圆角公式。
- 派生 `--radius-*` 可能被 Tailwind 内联而不输出同名 CSS 变量；文档取样改为在隔离节点上应用其原始表达式，再读取浏览器计算的圆角，避免显示“读取中”或失去当前基准。仍保留浏览器对负结果的既有边界处理。
- 新增真实工具栏七档切换检查，表格和色块的实际圆角逐项匹配生成基准；检查当前派生值同步更新、固定 radius.md 样本保持 8px。三个宽度的浅/深模式同时检查展示圆角与无未解析值。修复前定向用例失败，修复后开发与最终静态页面各六项 Docs 检查通过，Foundations Canvas 21 项通过；类型、相关 ESLint、构建与 diff 检查通过。
- 八份定义、registry 与完整覆盖清单哈希保持不变。日志为 `build/verification/foundation-reference/radius-{red,dev,build,static,canvas}.log`，截图为同目录 `radius-{none,2xl}.png`。本轮未重跑完整设计门禁或 Web / 原生业务验收。

## Foundations 静态 token 表格（2026-10-21）

- 移除 CSS 和尺寸名称下的 details / summary 展开交互、重复的族说明、类型/层级/状态/主题轴、源码路径及原始声明；分类页共用表格同步精简。表格只保留名称、当前模式值和预览，删除无引用的状态标签映射与展开样式。完整元数据继续保留在工程文档和生成覆盖清单中。
- 更新既有回归以检查表格没有折叠控件，同时保留定义名称集合、尺寸数量、主题切换、真实 manager 页内导航和分类示例检查。开发服务与最终静态页面各六项 Docs 检查通过，Foundations Canvas 21 项通过；类型、相关 ESLint、静态构建与 diff 格式检查通过。
- 八份定义、registry 和覆盖清单文件的哈希仍与精简前一致。日志在 `build/verification/foundation-reference/remove-details-{dev,build,static,canvas}.log`；仅调整 Storybook 与文档，未重跑完整设计或 Web / 原生业务验收。

## Foundations 目录保留 Storybook 外壳（2026-10-21）

- 复现用户点击右侧目录后整个页面跳到 `iframe.html#foundation-*` 的问题。Storybook 生成的 iframe 文档包含 `<base target="_parent">`，未指定 target 的目录和标题锚点继承父页面导航；先前独立 Docs 页的锚点检查无法发现 manager 被替换的问题。
- 目录和分区标题的原生锚点显式使用 `target="_self"`，保留浏览器 hash、滚动和焦点行为，定位限定于当前 preview 文档；不修改 Storybook 全局 base 或其他页面的链接策略。
- 新回归从真实 Storybook manager 点击目录与分区标题，检查导航发生在子 frame、父 URL 不变、spacing 定位和侧栏/工具栏继续可用。修复前定向测试明确失败于“A section link must not navigate the Storybook manager”，修复后开发服务和最终静态页面各六项 Docs 回归通过；目录高亮、类型、相关 ESLint 与静态构建检查通过。证据在 `build/verification/foundation-reference/section-navigation-{red,green,build,static}.log`，代表截图为同目录 `manager-section-navigation.png`。

## Foundations 当前模式展示（2026-10-21）

- 根据工具栏当前亮／暗模式显示一个色样和值，表头同步显示 `Value · light` 或 `Value · dark`，移除并排双色样。隐藏文档只解析当前模式与外观；监听根节点模式 class 及已有外观属性，签名去重，卸载时断开 observer 并移除取样文档。展开详情仍可查阅全部原始声明。
- 阴影、圆角与字体也读取当前模式和外观下的 CSS 计算值，预览不再固定使用第一条浅色声明。生产定义、registry 和完整生成清单与精简前八份文件的 SHA-256 逐项一致；仅修改文档展示。
- 真实 Docs 回归覆盖 320 / 390 / 1368px × light / dark，核对每个颜色仅展示当前模式、背景值和 primary 与生产一致、阴影与当前 root 计算值一致。实际 manager 工具栏完成 light → dark → light 切换，检查模式与值同步及取样 iframe 保持一个；分类示例、详情、导航和溢出检查继续通过。
- 类型与相关 ESLint 检查通过，静态 Storybook 构建通过；全部 Foundations Canvas 定向回归 21 项通过（12 个文件通过、6 个按标签配置跳过），最终静态 Docs 六项通过。日志为 `build/verification/foundation-reference/current-mode-{canvas,build,docs}.log`，模式切换截图为同目录 `toolbar-{light,dark}.png`。未重跑上一轮已通过的完整设计门禁或 Web / 原生业务验收。

## Foundations 展示精简（2026-10-21）

- All tokens 聚焦 112 项非适配层 CSS 定义与全部 28 项尺寸基准，共九个分区；38 项工具类映射、12 项运行时输出、4 项上游定位输出、17 项维护契约及 Usage 移到 [Token 工程维护与集成](token-engineering.md) 和完整生成清单。分类页也移除维护表格，原来仅包含工程信息的 Layering / Responsive 页面撤下，Motion 分类保留真实抽屉验收入口。
- 按钮密度、字体角色/排版偏好、焦点检查与验收链接只在分类页展示。尺寸表的状态、别名表达式、用途和消费说明收进原生 details；浅/深色样继续按等宽双列对齐，窄屏上下排列。
- 精简前保存八份定义、registry 和生成清单的 SHA-256；检查结果逐字节一致。`tokens:check` 仍覆盖 150 CSS / 12 runtime / 28 portable / 17 owned / 九类与 104 个 Web 消费文件、两个原生消费文件，未裁剪定义或生产源码。哈希基线在 `build/verification/foundation-reference/definition-hashes-before-simplify.json`，新增文档的本地链接检查通过。
- 更新真实 Docs 回归，核对全部非适配层 CSS 的名称集合、全部尺寸、工程表格与重复示例的缺席、尺寸状态展开/收起、真实 manager 分类导航，以及 Size / Typography / Elevation / Motion 分类示例继续可用。开发服务上的 320 / 390 / 1368px × light / dark 六项检查通过，类型检查通过。
- `pnpm verify:design` 通过：262/262 浏览器测试、47 个文件通过、18 个按既有标签配置跳过；token 15 项、设计清单 10 项、图标 5 项、Storybook 配置 4 项和 palette 两项检查通过。类型、lint 与静态构建通过；既有 chunk 体积提示、MaxListeners 警告未在此轮修改。日志为 `build/verification/foundation-reference/simplify-verify-design.log`，截图与最后的静态构建/六项 Docs 复核日志同目录保存。本轮只修改 Storybook 与文档，未重跑 Web 业务全量或原生真机验收。

## Foundations 文档展示更新（2026-10-21）

- 参考 Astryx Foundations 的分类、标题/说明、分区表格和侧目录布局，统一 Storybook Foundations 的 Docs 展示。增加 All tokens 总览及 Color、Elevation、Icons、Motion、Shape、Spacing、Typography、Sizing、Layering、Responsive 分类；旧 tokens / effects 的稳定 story ID 保留。原颜色诊断、排版调整、动效与实时 palette 场景继续在 Canvas 验收，Docs 通过入口访问，不自动运行全部诊断。
- 覆盖清单生成器同时输出 `design/token-coverage.generated.json`，与 Markdown 共用 CSS、运行时、便携尺寸和所有权解析结果；150 个静态 CSS、12 项运行时、28 个便携尺寸、17 个契约及四项上游输出逐项进入总览，未手工重抄定义。新增 JSON 漂移、只读和 mtime 回归，最终 token 测试 15/15 通过。数据、CSS 与样本解析仅用于 Storybook，未加入生产依赖图或改动产品 token 数值。
- 浅/深双色样在一个隔离、无脚本的文档中加载生产 CSS，使用当前配色采样 sRGB；外层主题和真实偏好不会因取样被切换或保存。宽屏使用固定侧目录，窄屏自然换行；修复返回顶部后目录仍高亮旧分区的问题，滚动更新按浏览器帧合并并清理监听器。隐藏 Storybook onboarding 清单以保留分类阅读空间；本地 6006 服务已按原 localhost 配置重启。
- 新增真实 Docs 启动与 manager 导航回归，覆盖 320 / 390 / 1368px × light / dark，其中 390px 使用 blue 配色；检查定义计数、来源展开、双色样与生产颜色一致、外层主题不被取样修改、页内锚点/高亮、返回顶部和页面不横向溢出。旧总览测试中直接导航锚点曾导致 Vitest tester frame 的 URL 被改写而断线；锚点行为已转到真实 Docs 回归验证，Canvas 保留结构和内容检查，未禁用真实导航或降低断言。代表截图保存在 `build/verification/foundation-reference/`。
- `pnpm verify:design` 通过：264/264 浏览器测试、49 个文件通过、20 个按既有 mobile/desktop 分类配置跳过；原颜色/排版/动效、组件 Docs、字体/离线回退与两项 palette 检查保留。类型、lint、静态 Storybook 构建通过。
- 首次与设计门禁并行的 Web 全量为 1084/1087：Mermaid flowchart、编辑器撤销后弹窗与草稿列表场景均超过原 5 秒期限。保留原源码、断言、worker 与 timeout；待设计浏览器测试完成后，单独执行完整 `pnpm verify:web`，1087/1087 UI、16/16 MCP、类型/lint、构建和原资源预算全部通过。首屏仍为 190,783 bytes gzip，产物入口/路由哈希与此次展示修改前相同。未据一次复跑通过断言原环境波动已消除，也未修改三个业务测试。
- 日志：`build/verification/systematic-tokens/storybook-reference-{verify-design.log,verify-web.log,verify-web-standalone.log,docs.log,canvas.log,token-tests.log}`。未运行远程 CI、安装或发布 App；本项可见与交互证据来自本机 Chromium。

## 系统性 token 全面复审（2026-10-21）

- **修复消费清单缺口**：原清单只有代表入口，无法据此排除消费者遗漏。现从生产入口扫描 150 个模块、23 份可达 CSS，生成 104 份有直接/工具类/样式类变量依赖、局部覆盖或 TS 尺寸引用的文件索引；另扫描全部 Apple Sources，列出 NativeSidebar 的尺寸消费与 WebView 的 CSS 输出。覆盖动态标签/标注/配色、Mermaid、危险动作局部覆盖、原生 palette 和圆角 bridge；Tailwind 原始标尺的实际变量依赖也纳入索引，已内联的断点/度量保留上游及组件所有权。样式类与模板展开是可能集合，生产依赖图和 DEBUG 引用不等于所有运行分支已执行。
- **修复定义与归属缺口**：补登 WebView 基于 scrollInsets 写入的 `--ios-top` / `--ios-bottom`，以及 Base UI 局部输出的 `--available-height` / `--available-width` / `--anchor-width` / `--transform-origin`。补齐内容颜色/布局、快速记录动效、主题切换过渡和其余内容浮层/响应式规则的拥有者；派生圆角与标签内部灰色输入明确为 alias。复审后为九类、150 个静态公开 CSS 名称、12 项 Web/原生运行时输出、28 个可移植尺寸、17 项所有权契约及四项上游定位变量。没有新增这些变量的运行时写入或修改现有值。
- **防止再次遗漏**：所有生产 CSS 必须登记所有者；消费者中的普通 var()/工具类简写引用必须存在于公开、局部、生成或上游契约；无界动态读取必须登记，palette 契约与真实 IOS_PALETTE_KEYS 一致；reserved 角色被生产消费时必须更新状态。公开定义位置检查补覆盖 html/body、主题复合选择器、:where(:root) 与 @property。最终 `tokens:build` / `tokens:check`、15/15 token 回归通过，包含删除原生/上游契约、丢失 CSS 归属和未登记动态读取等反例。测试与生成器不执行任意产品代码，palette 名称一致性测试只导入无顶层副作用的键定义模块。
- **外观与交互保持**：重新确认原基线 CSS 文件与 HEAD 一致。比较拆分前后全部声明（不只 token），styles.css 432 项、tag-colors.css 80 项、import-layout.css 108 项的选择器、外层 at-rule、属性/值与 important 多重集合相同；移动的连续 token 块内部顺序保持。224 组外观 × 180 个变量、代表生产控件计算样式与原生 palette 再次一致，默认浅/深色截图逐字节相同，Dialog/Sheet 打开与 Escape 关闭检查通过。生产 TS/TSX、偏好/存储/交互、便携 JSON 与 CSS/TS/Swift 尺寸输出均未改变。
- **完整门禁**：`pnpm verify:web` 通过（1087/1087 UI、16/16 MCP、类型/lint、构建和预算；首屏仍为 190,783 bytes gzip）。`pnpm verify:design` 通过（250/250 浏览器故事、40 个文件通过、14 个按既有配置跳过，2/2 palette 检查）。保留既有编辑器 Hook lint warning、Storybook 大 chunk 提示和 Vitest MaxListeners warning，未降低阈值或修改生产行为。之后对最终索引与 alias 元数据再次执行 token 生成、只读检查及 15 项回归，全部通过。
- 本机证据：`build/verification/systematic-tokens/audit-{source-preservation.json,preservation.log,verify-web.log,verify-design.log,token-tests-final.log}`，以及原 before/after JSON、浅/深色 PNG；这些辅助产物未提交。没有重新验收 Safari、真机/模拟器、VoiceOver 或全部字体字形，也没有触发远程 CI、安装或发布。

## 系统性 token 定义与源码整理（2026-10-21）

- 保留 shadcn/ui + Base UI + Tailwind 和现有系统支持范围。新增 [定义规范](token-system.md)、[registry](tokens/registry.json) 与 [生成覆盖清单](token-coverage.generated.md)，覆盖九类：150 个静态公开 CSS 名称、10 项运行时偏好输出（含对五个已有字体默认名称的覆盖）、28 个可移植尺寸与 14 项组件/平台/上游契约。保留 reserved、alias、baseline-only 和组件/平台所有权，登记完整不等于全部数值已提升为全局变量。
- 完成主题定义、标签/标注领域颜色、笔记默认字体三批源码整理。原加载入口导入新 token 文件，组件和平台相关数值继续在已登记来源维护。AST 比较确认原 styles.css 的 296 项、tag-colors.css 的 50 项、import-layout.css 的 20 项自定义属性声明，其选择器、值与 important 标记的多重集合一致；搬移的连续定义块内部顺序保留。未改生产 TS/TSX、偏好解析/存储、便携 JSON 或生成 CSS/TS/Swift 数值。
- 修改前后以同一 Chromium、1024×900 视口采集 2 个模式 × 8 个强调色 × 2 个中性色 × 7 档圆角，共 224 组。逐组比较 180 个 CSS 变量、真实 Button/Input/Switch/Tabs/标签的代表计算样式和生产 readIOSPalette 输出，全部一致。代表默认浅/深色的生产控件夹具截图逐字节一致；实际 Dialog 和 Sheet 打开、Escape 关闭检查通过。不是整个产品页面或全部组件状态的截图对比。本机证据在 `build/verification/systematic-tokens/preservation.json`、`before.json`、`after.json` 和 PNG 中。
- `tokens:build` / `tokens:check` 接入覆盖清单生成与只读检查；PostCSS 仅为根开发依赖。检查名称唯一归属、类型/主题轴/状态元数据、CSS 引用、默认/单个声明 scope 的别名环、公开定义位置、生产 CSS 导入可达性、运行时字面量输出及文档漂移。复用生产依赖图，不执行产品 JavaScript 或访问用户笔记库。新增反例和原有 token 测试最终 13/13 通过；完整 CSS cascade 和任意动态 JavaScript 不由静态检查模拟。
- `pnpm verify:web` 通过：1087/1087 UI 测试、16/16 MCP 测试、类型/lint、现有 CI/Apple 编排测试、生产构建和原有首屏/路由预算。初始 JS+CSS 为 190,783 bytes gzip，现有上限 192,512 bytes，未放宽预算。保留既有 RichMarkdownEditor Hook lint warning；本轮未改变该组件。
- 首次设计门禁有两项颜色故事导入失败：示例仍从旧 styles.css 的 raw 文本提取 @theme。已将其改为读取新的权威主题文件，同步来源说明，未修改故事行为断言或阈值。最终 `pnpm verify:design` 通过：13 项 token、10 项维护表、5 项图标、4 项 Storybook 配置测试、类型/lint、静态构建、250/250 浏览器回归，以及 2 项真实 palette/只读生成检查；14 个测试文件按原配置跳过。日志为本机 `verify-web.log`、`verify-design-final.log`、`token-tests-final.log`。后续补齐加载可达性检查的最终 token 回归亦为 13/13。
- 未重新进行 Safari、iOS/macOS 真机、模拟器或 VoiceOver 验收，未触发远程 CI、构建/安装 App 或发布。颜色诊断中的既有对比度问题保持原记录，不借 token 整理改变当前外观。

## Docs 异步就绪与原生 CI 环境（2026-10-20）

- `76de4e4` 的正式 CI 在 Docs 代码区缺少 `pre`、取消切库场景，以及原生 `simctl launch` 三处失败。原生任务独立运行仍超时，不能将任务隔离标记为修复。探针构建、安装完成，未取得断言结果；原始 [Verify 记录](https://github.com/divikwu/memocard/actions/runs/39364109551) 保留。
- Docs 混合定向两次为 18/19，真实 Source 停留在 Suspense 空容器；只为展开操作增加 `act` 没有解决。夹具改为在首次渲染之后，显式等待 `vi.dynamicImportSettled()` 并在 `act` 内提交，再执行原来的代码内容与页签状态断言，混合定向为 19/19。没有 mock Source、增加 sleep、提高 timeout 或修改 worker。
- 取消切库场景先加载真实原列表，再导航设置页发起取消操作，并增加 mock 数据快照不变断言。预览场景 54/54、完整 UI 单测 1058/1058、Storybook 类型检查、静态构建及相关 ESLint 通过。文档中的标题下间距同步为实际 16px，上方仍为 48px。
- 修复后的本机设计全量为 101/104：Docs 通过，颜色 Default/Mobile 与侧栏断点失败；此前原配置本机全量为 102/104。保留失败，不将本机全量标为通过；最新完整门禁以 PR #52 head 的远程结果为准。没有新增实际 Storybook 页面可见验收。
- 原版探针入口的有/无 preflight 对照均通过；随后系统临时目录、工作区临时目录及保留证据目录的 [三组 ARM 对照](https://github.com/divikwu/memocard/actions/runs/39364993500) 全部通过，不能将路径、清理或 preflight 单独归因。任务拆分已撤回；Intel 独立探针也失败，更换 runner 尚未证实有效，恢复原 ARM runner、完整 `verify:release` 和 preflight。探针入口补上 App init 阶段标记，启动期限失败后有界采样 simctl、匹配的 Simulator 探针进程和宿主内存状态；原断言、预算和无重试策略不变，晚到结果不能通过。Apple 内部阻塞原因尚未确认，远程结果另记于 PR；临时诊断 workflow 不进入 main。
- 上述诊断 head `e78f1b7` 的 [完整 Verify](https://github.com/divikwu/memocard/actions/runs/39366377965) design 104/104 与 release 全部通过，包含原生 42 字段、6 订阅场景、3 输入、15 预览 guard、2 预览交互、7 次逐字输入、12 chrome 检查及三项原生构建/签名。日志实际显示 spawn 45.897 秒、整体完成 57.502 秒，共享 60 秒仅余 2.498 秒；不能由一次通过断言内部启动故障已解决。
- 因此后续明确拆分功能探针预算：启动 RPC 作为有界环境操作为 180 秒，确认启动后的完成等待 60 秒；App task 另输出单调时钟耗时，必须有限、非负且不超过 60 秒，防止启动等待期间发生的慢断言被隐藏。控制器最大 180 + 60 秒，不含失败诊断/清理，无重试。原生断言与结果 JSON 不变；这是功能测试编排修复，不是 App 启动性能改善。导入 main 边界让实际 `launch_probe` 可直接回归：修复前模拟 70 秒启动在共享 60 秒处失败；修复后七项 controller 回归通过，包含超长启动、缺失完成、隐藏的 61 秒断言、无效计时和失败结果。红绿日志为 `/tmp/memocard-native-launch-protocol-{red,green}.log`，真实新 head CI 另记于 PR。
- `f8a65c6` 的 [正式 Verify](https://github.com/divikwu/memocard/actions/runs/39369218904) design 104/104 通过；release 在 Web 单测阶段失败，尚未运行新原生探针：属性保存失败场景未在默认查询期限内取得“属性”按钮，笔记删除的复合流程超过整项 5 秒。预览 helper 现于 render 后等待实际动态导入及 React 提交；删除回归拆成取消/失败保留与失败后直接重试两条，保留取消、错误、正文、最新 hash、返回主页断言，不提高 timeout 或修改 worker。两文件定向 129/129、完整 Web 单测 62 文件 / 1059 项、类型检查、相关 ESLint 和 7 项原生控制器回归通过；完整新 head 结果另记于 PR，不将此次 CI 记为原生通过。本机日志为 `/tmp/memocard-final-web-readiness-{targeted,full}.log`。
- `eb4fb8c` 的 [Verify](https://github.com/divikwu/memocard/actions/runs/39370485061) design 104/104 通过，前述两项 Web 回归通过；release 为 1058/1059，新的失败是标签建议 Enter 仍使用 `#工` 而非已显示的 `#工作/项目`。组件异步 listTags 结果会同时更新列表和 effect 中的键盘监听器；测试原先仅同步 act 输入，DOM 查询可能先于监听器 effect。测试现用异步 act 完成该真实更新再发 Enter，正文/onChange/建议关闭原断言保持，未改生产组件或增加等待期限。修改后编辑器完整文件 150/150 和相关 ESLint 通过，日志 `/tmp/memocard-tag-suggestion-effect-readiness.log`；新 head 的完整门禁另记于 PR。源码解释与 CI 现场相符，但未把全部环境波动归因于这一处时序。
- 本机日志：`/tmp/memocard-button-docs-mixed-{instrumented,act,import-settled}.log`、`/tmp/memocard-button-docs-full-import-settled.log`、`/tmp/memocard-preview-scenarios-regression.log`、`/tmp/memocard-ui-readiness-full-unit.log` 和 `/tmp/memocard-docs-readiness-{storybook-build,eslint}.log`。工作区并行编辑器/标签改动未纳入这次修复。

## Button Controls、Sizes 与 Docs 状态回归（2026-10-20）

- 仅过滤固定示例的 Controls：Variants 排除 `variant` / `children`，Sizes 排除 `size` / `children` / 仅部分生效的 `aria-label`，固定 KeyboardAndDisabled 夹具关闭 Controls。Default、Properties、共享 API metadata、六变体和八尺寸的 render 及既有 play 不变。
- Sizes 启用现有自然高度模式并移除使用点的固定高度覆盖。将原 iframe 布局观察器移至 Storybook 专用模块供实际渲染与测试复用；`autoHeight` 与 `centered` 组合时保留居中，取消与 iframe 视口高度绑定的 min-height。其他固定高、主题/数据隔离及 observer/listener 清理保持。
- 新增独立 `button-docs` 浏览器 project 的 3 项持续回归：真实 DocsRenderer/CSF/三页签，六项参数、点击计数、展开代码与 Reset 后再切页的状态保留；同一 iframe/document/控件身份、hidden/inert/display:none 和原生 Tab 跳过；Sizes 在 700→320→700px 下八尺寸完整、自然增高及回缩、保持居中且内部无裁切/横滚。仅 iframe 装载使用 `about:blank` fixture，样式来自实际 Vite/Tailwind 输出；测试适配器绑定现有 Storybook 10.6.2，不访问 Storybook 服务或用户页面。
- 两项负向控制均检测失败：临时关闭 Properties 的 `keepMounted` 后失去保留面板；自然高度模式跳过居中后测得约 120px 水平偏移（容差仍为 1px）。源码已恢复，公开 `setProjectAnnotations` 初始化后的三项正向回归通过，没有修改 worker、超时或原有断言。
- Sizes 首轮 240px 测试检测到 320px 横滚。最初怀疑宿主样式污染，限定注入实际 preview/Button CSS 后仍复现，进一步定位为生产 `styles.css` 中 `@apply min-w-80` 的既有 320px body 下限。最终按原有支持边界测试，没有覆盖最小宽度、改动生产 CSS 或放宽溢出/居中检查；原始失败和诊断记录保留。
- 初次完整设计运行为 99/104：新增三项通过；既有 Button Properties 未及时取得代码 pre、搜索 RetryAndPagination 可见性失败，以及颜色 Default/Mobile、侧栏断点超时。未修改对应 play 或超时；原样定向 Button/搜索/颜色 18/18 与断点 1/1 随后通过，首次根因未确认，不将定向通过写成问题已消除。
- 第二次原配置全量复跑为 87/104，新增三项仍通过；出现更多既有故事超时与截图超时，不能标记全量门禁通过。基线 `277b9ca` 的远程 [design run](https://github.com/divikwu/memocard/actions/runs/39353522760) 已在 Note Search RetryAndPagination 的同一可见性断言失败（100/101）；这只证明该搜索失败已存在，其他失败的根因仍未确认。
- 为修正搜索故事明确的就绪缺口，在公共 `searchDialog` helper 增加对同一弹窗的 `toBeVisible()` 等待；此前只等待 DOM 和输入焦点。保留生产动画、原超时及全部业务断言，不宣称已确认动画透明度就是全部失败根因。搜索定向 6/6 通过；一次混合定向为 18/19，新增 Docs 状态测试未及时取得懒加载代码 pre。测试夹具随后为直接调用 DocsRenderer 的渲染/卸载补上 React act 边界，保留对真实代码内容的等待，新增三项定向再次 3/3 通过；这尚不证明混跑问题已消除；最终全量结果以新 head 的 CI 为准。
- 提交 `7f5501704ceaaa370f387dc27227fbdc32c70998` 的独立 [CI design 门禁](https://github.com/divikwu/memocard/actions/runs/39356228890/job/118411528794) 通过完整 104/104、类型、Storybook 静态构建、维护表/token/icon 与 palette 检查。本机 act 修正后的混跑仍为 18/19；随后将测试就绪等待绑定实际 iframe 容器，并先断言 pre 存在，保持原超时与文本断言，但混跑仍为 18/19。此时诊断明确显示代码区停留在 Storybook Suspense 的空 div，懒加载尚未完成；不能据此断言导入失败、最终原因或本机不稳定已消除。最终 head 的 CI 单独记录在 PR，原始失败继续保留。
- Storybook 类型检查、生产 UI 构建、变更 TS/TSX 的 ESLint、diff 检查与全部 route/initial JS/CSS/字体预算通过，未提高预算。相对本轮基线 `277b9ca`，407 份 Web 源码与生产产物逐一 SHA256 一致；此前 PR 中已授权的 Tabs 样式修改不包含在这份增量证据内。原生组件与动作协议没有改动。
- 浏览器安全策略仍限制实际 localhost 页面观察；本轮自动检查不替代真实服务 iframe 启动、可见页面、真实剪贴板读回或原生验收。没有新增 Xcode Preview、模拟器或真机覆盖。完整远程门禁以 PR #52 最新 head 为准。
- 本机日志为 `/tmp/memocard-button-docs-contract-*`：初次完整失败保留在 `verify-design.log`，定向复现为 `failures-isolated.log` / `breakpoint-isolated.log`，两项负向控制为 `keep-mounted-negative.log` / `centering-negative.log`；生产指纹对照为 `production-parity.json`。这些是本机辅助证据，持续回归已接入 `pnpm verify:design`，跨机器请重跑维护命令。

## Tabs line 列表容器（2026-10-20）

- 按 tablist 标注，仅调整 `TabsList` 的 line 变体：四周 padding 由 3px 变为 0，默认列间距由 4px 变为 8px，行间距保留 4px。使用 `gap-2 gap-y-1 bg-transparent p-0`，默认变体仍有 3px padding，不新增断点；主页调用端及移动布局原有 gap 覆盖继续生效。保留原外部高度规则，内部 Trigger 随 padding 移除自然获得更多高度，不额外补偿高度或下划线位置。
- 首版 `gap-1 gap-x-2` 新增 CSS，使最紧路由达到 1,335,312 bytes raw，超过 1,335,296 上限；日志保留。最终等价复用已生成的 `gap-2` / `gap-y-1`，共享 CSS hash 与上一版一致，最紧路由为 1,335,267 bytes raw，所有 route / initial JS/CSS / 字体预算通过，没有修改预算。
- 最终生产构建（含类型）、Storybook 构建、Button / Tabs 10 项交互、NoteCollection 12 项回归、ESLint 与 diff 检查通过，独立静态审查通过。没有重跑完整 101 项或原生验收；实际可见/计算样式复核仍受浏览器安全策略限制。
- 本机最终日志为 `/tmp/memocard-tabs-line-list-final-{build,storybook-build,stories,collection,eslint,budget}.log`，首版超预算记录为 `/tmp/memocard-tabs-line-list-budget.log`；远程 CI 以 PR #52 最新 head 为准。

## Tabs line 左右内边距（2026-10-20）

- 根据 `components-tabs--line` 的标注，在生产 `TabsTrigger` 的现有 line 条件分支使用 `px-1`：左右各 4px，默认变体维持 `px-2` 的 8px，不添加断点或视口特例。规则适用于所有 line 消费者，包括 Button Docs 和主页页签；主页“最近更新”原已显式 4px，“已固定”同步为 4px。API 类型、上下间距、键盘和禁用行为保持。
- 仅新增条件类的首版使最紧移动路由从基线 1,335,281 / 1,335,296 bytes raw 增至 1,335,450，预算检查正确失败。最终以新 padding 条件类替换同分支重复的普通态透明背景类：普通态沿用已有 Preflight 透明背景，选中态及深色选中态的显式规则保留。最终路由 1,335,268 bytes raw，比基线少 13 bytes；gzip 增加 4 bytes，所有 route、initial CSS/JS 与字体预算通过，没有调整预算。
- 最终生产构建（含 TypeScript）、Storybook 静态构建、Button / Tabs 10 项交互、NoteCollection 12 项回归、变更 TSX 的 ESLint 和 diff 空白检查通过，独立静态审查通过。浏览器安全策略仍限制实际页面观察，本轮未完成 4px 的可见/计算样式复核，不把自动交互测试写成样式量测；没有重跑完整 101 项或原生验收。
- 本机日志为 `/tmp/memocard-tabs-line-padding-{baseline-build,baseline-budget,build,budget,final-build,storybook-build,final-budget,final-stories,final-collection,final-eslint}.log`，首版超预算记录保留在 `budget.log`。基线 CSS、产物指纹及前后体积对照位于 ignored 的 `build/verification/tabs-line-padding/`；远程 CI 以 PR #52 最新 head 为准。
- 后续按新的 4px → 0px 标注，仅将同一 line 条件类改为 `px-0`，默认变体仍为 8px，不添加断点；条件规则也覆盖主页调用端已有的普通 `px-1`。生产构建（含类型）、Storybook 构建、Button / Tabs 10 项与 NoteCollection 12 项回归、ESLint 和 diff 检查通过，独立静态审查通过。构建结束后重新执行预算检查，全部预算通过，最紧路由为 1,335,255 bytes raw；没有修改预算。实际可见/计算样式复核仍未完成。日志为 `/tmp/memocard-tabs-line-zero-{build,storybook-build,stories,collection,eslint,budget-final}.log`。

## Button 文档章节间距（2026-10-20）

- 仅调整 Button Docs 的局部 CSS：列表下边距改为 16px，与现有 Tabs 8px gap 合成到 Panel 的 24px；直接章节标题统一上 32px / 下 16px，覆盖 Storybook 对首个 `h2` 的顶部清零规则。相邻 `h2` / `h3` 保留 16px 层级间距；Panel 首元素不叠加默认顶部 margin。上述均为默认根字号下的 CSS 规则值，不是重新量测的渲染像素。
- 保留生产 Tabs `line` 的外观与焦点、Properties `keepMounted`、隐藏规则、代码面板、iframe 和 Markdown 内部排版。Button 7 项 + Tabs 3 项既有交互共 10/10、Storybook 静态构建与 diff 空白检查通过，独立静态复核通过。此轮仅改 CSS，未重跑类型检查、完整 101 项或原生验收。
- 浏览器页面观察仍受此前安全策略限制，本轮未进行调整后的实际可见/布局复核，未绕过限制。日志为 `/tmp/memocard-button-docs-rhythm-{tests,build}.log`；远程 CI 以 PR #52 最新 head 为准。
- 后续根据截图反馈，将直接章节标题间距进一步加大为上 48px / 下 24px，相邻章节与子标题间保留 24px。只改 Button Docs 局部 CSS 的两个数值，保留 Tabs 至 Panel 的间距与所有内部排版；静态构建及 diff 检查通过，独立静态审查通过。没有重复上一轮交互检查，仍未完成实际可见复核；日志为 `/tmp/memocard-button-docs-section-spacing-build.log`。

## Button 文档复用 Tabs（2026-10-20）

- Button Docs 改为导入项目已有的 `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`，在 `TabsList` 使用 `variant="line"`。删除文档重复的页签外观、选中态、焦点与响应式间距样式，仅保留列表外边距和隐藏 Panel 规则；其他表单、表格滚动区和代码面板的焦点样式保持。
- Properties 的 `keepMounted`、页签的 `activateOnFocus` 和现有 iframe 配置保持；生产 Tabs 实现未改。Button 7 项与 Tabs default / line / vertical 3 项既有交互检查共 10/10，通过 Storybook 类型检查、静态构建、变更 TSX 的 ESLint 和 diff 空白检查；独立静态复核无 P1/P2。
- 本轮未执行真实 Docs 页面可见复核：此前浏览器安全策略拒绝 localhost 页面观察，未通过其他 UI 工具绕过。自动检查不代替实际页签在 Docs 中的布局及跨页签保留状态验收。未重跑完整 101 项检查或原生验收；日志为 `/tmp/memocard-button-local-tabs-{tests,typecheck,build,eslint}.log`，远程 CI 以 PR #52 最新 head 为准。

## Properties 左右对齐（2026-10-20）

- 仅 Properties 故事改为 `layout: "fullscreen"`，其专属容器保留 `padding-block: 1rem`。真实 Docs 测量 iframe body padding 四边为 0，预览框与参数表左右 inset 均为 0，与外层说明的左右边缘差值均为 0；上下 16px、预览框内部 16px、表格单元格 12px 保持。
- Button 定向交互 7/7、Storybook 类型检查与静态构建、变更故事 ESLint 及 diff 空白检查通过。实际复核代码展开/收起的自然高度、切页保留参数和 Reset；900×786 manager 下页面宽度/scrollWidth 均为 489px，680px 参数表只在自身区域内横滚，临时视口已恢复，浏览器错误为空。没有重复执行上一轮完整 101 项检查，也未改其他故事、生产或原生组件。
- 本机日志为 `/tmp/memocard-button-properties-edge-{tests,typecheck,build,eslint}.log`，截图及 DOM 测量为 ignored 的 `build/verification/button-properties-edge/`；远程 CI 以 PR #52 最新 head 为准。

## Button 参数行、代码面板与切页状态（2026-10-20）

- Properties 改为一组八行参数：名称、类型/默认值、说明和当前控件在同一行；六项可编辑，`onClick` / `render` 只读。CSF 与参数行共用 Button 专属 metadata，移除重复 ArgTypes 表。所有 Button Docs 示例与参数预览共用代码面板，默认收起，使用 Storybook Source 的 TSX 高亮和内建 Copy，不增加第二个复制入口。
- 真实 Docs 已验证复杂文字、variant / size / type、禁用、Reset、图标名称、点击计数和动态代码同步；文字及图标代码分别通过实际 Copy 写入剪贴板并读回，与展示代码逐字相同。代码存在 71 个高亮 span，复制入口只有一个。七段从浏览器提取的完整 TSX 对实际生产导入的类型检查通过。
- Properties 仅在当前 Docs 会话保留挂载。实际切到 Accessibility 再返回后，参数、点击计数及代码展开状态保留；隐藏面板同时具有 `hidden` / `inert`，计算样式为 `display:none`，参数控件不在无障碍树中。代码展开/收起时 iframe 高度从 1,489px 恢复到 1,202px；最终左右留白各 16px。900×786 manager 下 Properties 文档宽度/scrollWidth 均为 489px，680px 参数表只在其 457px 区域内横滚，页面没有水平溢出；临时视口覆盖已恢复。
- Overview 按总览 → 用法 → 组成 → 使用建议 → 示例排列，补充图文、禁用与真实 `a href` 组合。实际 Enter 激活链接后，焦点到达同一示例 iframe 的目标段落，父 Docs 未导航；窄布局示例宽度/scrollWidth 均为 487px。无障碍说明明确键盘、命名、禁用/链接责任、4.5:1 / 3:1 的适用范围，以及既有 blue/slate primary 白字约 3.7617777:1 的缺口；未声称所有变体/状态或整页 AA 通过。未迁移 Input 的原布局和手动输入回显正常，两个页面浏览器错误记录均为空。
- 最终 `pnpm verify:design` 通过 101/101：100 个组件故事（88 桌面、12 H5）加 1 项真实断点回归，含 Button 7/7；类型、静态构建、维护表/token/icon 与真实 palette 检查通过。五个变更 TS/TSX 文件 ESLint、diff 空白检查通过，独立复核无剩余 P1/P2。未修改 worker、超时、断言强度或预算。
- 首次 Button 定向因新导入 `storybook/theming` 被晚发现而触发优化器 reload，7 个故事发生模块加载失败；显式加入既有 `optimizeDeps.include` 后定向 7/7 通过。后续静态检查发现新增 Copy 测试误用了 Playwright 的 `exact` 选项及未使用参数，已按 Testing Library 查询类型和 lint 修正。完整运行另曾出现未修改 Dropdown Menu 的菜单可见性断言失败（其余 100/101 通过）；原配置单跑 1/1 与完整 101/101 随后通过，初次失败原因未确定，原始日志保留，不将其写成已消除的时序问题。
- 与本轮基线 `969ce353` 比较，453 份生产源码、资源与 token 的 SHA256 全部一致，原有 Default、Variants、Sizes、KeyboardAndDisabled 四个故事定义逐字一致。没有修改生产 API、六变体、八尺寸、默认外观、原生组件、依赖或交互协议；本轮没有新增 Xcode Preview、模拟器或真机验收。
- 完整通过日志为 `/tmp/memocard-button-docs-complete-verify-design-accepted.log`，初次加载失败保留在 `/tmp/memocard-button-docs-unified-targeted.log`；静态失败为 `/tmp/memocard-button-docs-complete-verify-design.log` 与 `/tmp/memocard-button-docs-complete-eslint.log`，Dropdown 失败为 `/tmp/memocard-button-docs-complete-verify-design-final.log`。最终 lint / 代码类型检查日志为 `/tmp/memocard-button-docs-complete-{eslint-final,snippets-final}.log`；截图、AX 读回数据、实际复制代码及指纹位于 ignored 的 `build/verification/button-docs-complete/`。这些是本机辅助证据，远程 CI 以 PR #52 最新 head 为准。

## Button 文档分页与参数预览（2026-10-20）

- Button 专属 Docs 按 Astryx 的 Overview、Properties、Accessibility 分页。Overview 居中展示 MemoCard 原有六种变体，随后展示八种尺寸、用法、组成与使用建议；Canvas 代码默认收起。按用户可见复核意见去掉总览灰底和重复的内层圆角边框，只保留 Storybook 的外层预览框，生产按钮外观保持；根据后续可见意见将总览、尺寸、用法与键盘示例统一为 Docs 内水平、垂直居中，保留原 Canvas 布局。Properties 移除组件额外的 16px padding，仅保留 iframe 单层留白；真实 DOM 测量左右均为 16px。三个 Overview 示例的居中偏差为水平 0.25px（clientWidth 的子像素取整）、垂直 0px。其他试点继续使用原来的纵向模板。
- Properties 的六个带标签控件与真实生产 Button 位于同一隔离 iframe；修改 variant、size、children、type、aria-label、disabled 即时更新预览，Reset 恢复参数和内存点击计数。图标尺寸显示真实 Search，动态 JSX 使用 JSON 字符串表达式保留引号、花括号与尖括号；从真实 Docs 读取的文字、图标两段完整代码对实际生产导入的类型检查通过。新包装器关闭无效的外部 Canvas Controls，生产 API 表维持真实契约。
- 可见验收发现固定 540px iframe 会在窄布局展开代码时裁切；仅 Properties 开启 `docs.story.autoHeight`，按同源自然内容根的 ResizeObserver 调整高度，加载与切页时清理。实际复核代码展开时 API 下移、收起时高度恢复；其他故事保留固定高度和既有 document、存储与数据隔离。
- `pnpm verify:design` 最终通过：99 个故事（87 桌面、12 H5）加 1 项断点回归，共 100/100；类型、静态构建、维护表/token/icon 与真实 palette 检查通过。3 个变更 TSX 文件 ESLint 和 diff 空白检查通过，独立审查无 P1/P2。首次完整运行 99 个组件故事通过，既有断点用例在原 15 秒上限超时；未改源码或上限，单跑 1/1（1.04 秒）及完整原配置 100/100 随后通过，未确定初次超时原因。去灰底后静态构建和 Button 定向 6/6 通过；最终移除内层装饰后的静态构建与可见复核通过，后续居中与间距修正后再次完整 `pnpm verify:design` 100/100 通过，不将视觉调整视作新增交互覆盖。
- 真实 Storybook Docs 已完成 Overview → 方向键 Properties → Accessibility、参数修改/禁用/重置、图标名称与当前代码同步；键盘激活后 Tab 跳过禁用按钮并到达“下一项”。代码默认收起，六种变体和八种尺寸各在对应区域展示一次。未迁移 Input 的原布局及手动输入回显正常；最终导航浏览器错误记录为空。
- 453 份生产源码、资源与 token 指纹未变化；原有 Default、Variants、Sizes、KeyboardAndDisabled 四个 Button 故事与本轮基线逐字一致。未改生产组件、原生组件、依赖或交互协议。本轮未执行新的 Xcode Preview、模拟器或真机验收。
- 日志为 `/tmp/memocard-button-tabs-{targeted,verify-design,breakpoint,verify-design-final,no-gray-build,no-gray-tests,final-build,centered-tests,complete-final}.log`，截图、AX、真实代码和指纹位于 ignored 的 `build/verification/button-docs-tabs/`。初次超时保留在 `verify-design.log`，完整通过在 `verify-design-final.log` 与最终 `complete-final.log`；这些是本机辅助证据，远程 CI 以 PR #52 最终 head 为准。

## 组件使用文档试点（2026-10-20）

- Button、Input、Dialog、Note Search 复用一个 Storybook Docs 模板，增加用途、默认实际示例与最小生产代码、组成、使用建议、其他状态、API、无障碍和平台差异。Button 新增单按钮 Default；原有 14 个故事定义（含 args、play 和时限）与 main 逐字一致。未引入 MDX、组件注册表、运行时依赖或第二份组件维护清单。
- Button 显式列出 8 项常用生产参数，Input 列出 13 项；Dialog 的生产组合契约与示例 onSave 分开，Note Search 完整列出 7 个生产 props，并将 initialOpen 等示例控制项单列。Controls 只开放对当前故事真实生效的参数。独立审查曾发现 Button 的默认 type 文案错误；按已安装 Base UI useRender 的 renderTag 实现修正为默认路径提供 type="button"，提交需显式 submit，修复后独立复核无 P1/P2。未修改生产 Button 行为。
- `pnpm verify:design` 通过：97 个故事（85 桌面、12 H5）与 1 项断点回归，共 98/98；类型、静态构建、维护表/token/icon 及真实 palette 检查通过。没有修改 worker、断言、超时或预算。13 项跨 project 文件过滤不是跳过故事；报告中的 98 项测试全部执行并通过。4 段完整使用代码通过虚拟 TSX 文件对实际生产导入的类型检查，没有创建临时生产源码；6 个变更 TSX 文件的 ESLint 通过。
- `pnpm --filter @memocard/ui build` 与 `pnpm check:bundle` 通过。285 份指定 Web/原生源码、资源与 token 文件，以及 164 份生产构建产物，与实施前逐一 SHA256 一致，无修改；生产移动首页仍为 1,335,281 / 1,335,296 bytes raw。生产构建原有大 chunk 提示保留。改动仅在 Storybook 与设计文档中，不将此轮计作 Xcode Preview、模拟器或真机验收。
- 真实 Storybook Docs 已核对四个试点的说明、生产代码、参数表和单次主示例：Button 的 variant/size/type 可见且默认值正确，Input 手动输入后回显一致；Dialog 实际打开、Escape 关闭，在退出过渡完成后焦点返回触发器；Note Search 输入“计划”、方向键选中“计划清单”、Enter 后回调显示 search-checklist，关闭后焦点返回“返回搜索”。Canvas 将 Button 的 variant 调为 outline、size 调为 lg，控件和实际按钮更新，随后 Reset controls 恢复默认，没有保存故事改动。
- 全局 Docs 去重仅增加 Stories.includePrimary=false。未迁移的 Select 主故事和 Small 各出现一次；手动将首个选择框改为深色时，另外四个示例仍为浅色。Foundations Effects 的 Default、Dark、Reduced Motion 各出现一次，深色内容保持在独立 iframe 中，外围 Docs 仍为浅色。Docs 仍停止自动 play，手动交互、主题和数据隔离保留。
- 初次在并行静态构建期间打开开发服务，观察到 4 条 Storybook manager UniversalStoreFollowerTimeoutError；原始日志保留。完整构建后通过新导航完成上述检查，后续错误为 0，保留 1 条 Storybook 11 的 PopoverProvider ariaLabel 升级提示；没有修改产品代码或根据一次后续通过判断初次错误根因。首次 Dialog 关闭读取仍处于退出动画中，最终按过渡完成后的 DOM 和焦点确认关闭，不放宽原有交互测试。
- 本机日志为 `/tmp/memocard-component-docs-{verify-design,snippets,eslint,production-build,bundle}.log`，可见截图、AX 快照和源码/产物指纹位于 ignored 的 `build/verification/component-docs-pilot/`。这些文件作本机辅助证据，跨机器应重跑维护中的故事与设计门禁；远程 CI 以新 PR 的最终 head 为准。

## Foundations 颜色状态、排版与动效边界（2026-10-19）

- 本轮只扩展现有 Foundations 故事、独立浏览器测试配置和维护文档。默认外观、生产 CSS/Provider、token、原生组件及交互保持；不新增平行主题或排版规范。
- colors 共 5 个代表故事：默认浅/深、浅色 blue/slate、深色 teal、H5；读取 35 个生产语义色并测量 22 组配对（13 组语义、9 组标签）。其中 20 组普通文字使用未舍入的 4.5:1，`accent-text` 的当前固定图标按非文本 3:1，另 1 组 TabsList 容器色对只作诊断；禁用态不并入普通文字结论。配合真实 Button 的 hover/focus/disabled、Input 的输入/invalid、Tabs 的选中/键盘状态，检查实际渲染。浅色 blue/slate 的 primary 配白字实测约 3.7617777:1，作为既有普通文字 AA 问题保留，不修改默认外观。Tabs 容器约 4.4648:1 不能直接当作真实 Tab 文字缺陷，需以 Trigger 实际绘制颜色为准。颜色诊断故事通过不等于全部颜色 AA 通过。colors 定向 5/5 通过，日志 `/tmp/memocard-foundations-colors-final.log`；初版 synthetic hover 未触发真实 `:hover`，改用 Vitest locator 的实际指针悬停。临时将该动作 no-op 的负向 Default 检查确实失败，恢复后原样通过，日志 `/tmp/memocard-foundations-colors-hover-negative.log`。
- effects 增加深色图标/阴影/焦点和生产 Sheet，自动测试通过 Playwright 临时切换真实 `prefers-reduced-motion` 媒体偏好，比较常规与 reduce 的实际 computed 动画/过渡时长，验证关闭/Escape/焦点恢复，并恢复媒体偏好；不以更换类名或伪造 CSS 模拟系统设置。Canvas 遵循当前浏览器/系统偏好，故事名称本身不代表浏览器已进入 reduce。effects 定向 3/3 通过；临时将媒体模拟命令改为 no-op 的负向检查在实际 matchMedia 仍为 false 时失败，恢复配置后原样 3/3 通过，未改生产 CSS。日志为 `/tmp/memocard-foundations-motion-negative.log` 与 `/tmp/memocard-foundations-effects-restored.log`。
- typography 共 4 个故事：保留默认 16px → 18px → 恢复；紧凑边界 14px / 1.6 / 60 / 1em、宽松边界 18px / 1.9 / 90 / 2em 来自生产 options，初始值与交互均经过既有 parseTypography / TypographyProvider。检查实际字号、行高、段落 margin、阅读宽度变量消费与真实文章尺寸，验证调宽确实增宽、调小段距确实缩小，以及恢复默认。长中文/英文段落、列表、长链接与代码使用生产 Typeset；真实 H5 390×844 下紧凑、宽松和恢复三种状态均断言页面/样本不发生水平溢出，长代码沿既有规则在自身横滚。
- 排版定向 Chromium 4/4 已通过（3 个桌面、1 个 H5）；本机日志 `/tmp/memocard-foundations-typography-targeted-final.log`。初轮 Storybook 类型检查曾被并行动效 command 类型声明拦住，最终 `typecheck:storybook` 已通过，日志 `/tmp/memocard-foundations-typography-typecheck-final.log`；`pnpm verify` 已通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，生产移动首页预算仍为 1,335,281 / 1,335,296 bytes raw。完整 `pnpm verify:design` 已通过：97/97（84 个桌面 1024×900、12 个 H5 390×844 故事及 1 项真实断点回归），包括类型、静态构建、维护表/token/icon 检查和真实 palette 回归，日志 `/tmp/memocard-foundations-verify-design.log`。未改 worker、超时或预算；远程 CI 以新 PR 最终 head 为准。可见 IAB 已检查排版紧凑 → 宽松 → 默认 16 / 1.6 / 90 / 1em，及 effects 深色生产 Sheet 打开、Escape 关闭与入口焦点恢复；手动窗口不代替自动视口断言。Storybook manager 的 H5 Canvas 曾因附加面板把可见高度压到 298px，初版高度断言失败；现仅在浏览器测试模式断言完整 844px 高度，manager 仍检查真实 390px 宽度和全部溢出边界。自动项目继续逐项验证真实完整视口，未修改视口配置或溢出断言。修正后真实 manager 重新运行的 Interactions 已显示 PASS，并手动切到 18 / 1.9 / 90 / 2em；H5 可见截图为本机 `build/verification/foundations-state-coverage/typography-h5-visible.png`。
- 最终生产构建后，614 份 Web 源码/产物、iOS 源码/资源及 token 文件与实施前逐一 SHA256 一致，无新增/删除/修改，证据为本机 `build/verification/foundations-state-coverage/production-parity.json`；可见 colors blue/slate 的诊断、实际输入/Shift+Tab 焦点返回、方向键切到已固定也已完成，截图 `colors-state-visible.png`。这不代替远程 CI。未覆盖全部 palette/neutral 组合、全部字体字形/加载失败、所有组件/色对、整页 WCAG、旧浏览器或 iOS Preview/模拟器，本轮不重用前轮平台验收为新覆盖。

## 编辑器与原生页面外壳（2026-10-19）

- 新增真实 Editor 的 5 个故事：标题/正文编辑与自动保存、保存失败/重试、保存中禁用、只读、H5 失败/重试；调用方通过现有 `EditorHandle.finish()` 返回真实 NoteCollection，再次打开通过 `getNote` 读回。断言同时检查输入保留、恢复草稿与已提交笔记分离、重试载荷一致、提交版本、回调和无重复写入。bridge 只接受指定内存笔记、binding、路径及当前版本，无真实笔记库 fallback。
- 新增真实 NativeMainChrome 的 Collection / Detail / Busy / Dark Large 四个独立 `#Preview`。仅 DEBUG 预览 host 注入明确标识的只读占位正文；普通 App 仍使用原 WebView，Release 保留原渲染路径。12 项新原生检查覆盖布局、固定、返回、busy/旧 instance/未知动作拒绝，以及真实 hosting view 中有 UINavigationBar、无 WKWebView（含未注入正文的预览 host）。原有 42 个字段、6 个订阅场景、3 个 UIKit 输入、15 个预览 guard、2 个交互闭环和 7 个逐字输入断言仍通过。
- 首轮 Editor 导入被 Vite 的晚发现依赖重优化打断；仅在独立 Storybook 配置中补齐实际日志列出的 19 个依赖，没有改生产构建配置。定向首轮曾有一次 ResizeObserver loop 提示，保留记录，后续单项及完整运行未复现，未确定其根因。清除生成的依赖缓存后，88 个故事全部通过，既有断点用例在原 15 秒上限超时；原样单独运行 1/1 通过（1.13 秒），最终完整 `pnpm verify:design` 89/89 通过：78 个桌面 1024×900、10 个 H5 390×844 故事和 1 项真实断点回归。未修改断点用例、worker、等待上限或断言；并行构建与超时的因果关系未经确认。类型、静态构建、组件维护/token 映射、token/icon 与真实 palette 检查全部通过。
- `pnpm verify` 通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，类型/lint/生产构建与全部资源预算通过；既有编辑器 Hook 警告和大 chunk 提示保留。移动首页仍为 1,335,281 / 1,335,296 bytes raw，未提高预算。原生 probe 的 Debug 构建与独立 iOS arm64 Simulator Release 构建成功，Release 符号中无 MainChrome/Surface 预览实现；工程文件未改。
- Storybook 实际 Canvas 手动输入“Storybook 标题验收 / Storybook 正文验收”，观察保存失败时内容保留，点击真实“重试保存”后集合显示新值，再打开读回一致。使用现有 Core embed 模式暂停自动 play 以便手动操作；手动窗口尺寸不代替上述浏览器视口断言。Xcode Canvas 四个入口均实际渲染，Live Preview 通过真实原生固定、系统页面菜单/新建和返回显示对应反馈；Canvas 内层 AX 快照滞后时按新截图坐标操作，没有把失效 AX 点击算作成功。
- iPhone 18 Pro / iOS 27.0 使用独立 `dev.divikwu.memocard.editor-probe` bundle，复用真实 App、Editor、EditorSession、WKWebView 和原生 Chrome。仅数据响应为严格限定笔记/binding/版本的内存 fixture，原生 uiReady/updateNativeSurface 仍走真实 handler；修改后的保存持续失败，直至实际“重试保存”点击。首轮保存后重开触发了隔离 fixture 未清理已提交草稿造成的旧版本冲突，红审计已保留；按真实 Store 的匹配提交清理语义修正 fixture，5 项草稿匹配自检通过，未放宽版本 guard。最终重新可见完成标题 EditorQA、正文首段 BodyQA 编辑、失败保留、原生返回再次失败仍停留、重试成功返回真实集合及重新打开读回；其余原段落保留。最终审计为失败 3 次、显式重试 1 次、成功保存 1 次、匹配草稿清理 1 次，草稿为空、页面错误/JS 错误/拒绝请求均为 0。真实 App 的 170 份已安装文件、58 份 QA 库文件、bookmark/layout 及 395 份 Web 源码/产物均与基线一致。验收后恢复关闭 Capture Keyboard、卸载独立 probe 并重新打开原 App；不将内存成功视为磁盘持久化验收。
- 独立验收入口初版试图重新定义 WebKit 的不可配置 `window.webkit`，曾导致空白页；仅修正 ignored 测试入口以包装其可配置 handler，之后真实 App 正常渲染。该问题没有进入生产源码。手机键入期间的候选栏内容不作为输入真值，以真实 DOM 只读审计和画面核对；本轮不声明中文 IME、所有富文本节点、冲突解决、系统选择器、iCloud、旧系统或真机覆盖。
- 本机日志为 `/tmp/memocard-editor-{design-final,verify,native-chrome-probe-final,release-build}.log`，截图与隔离审计位于 `build/verification/editor-preview/`。这些 ignored 文件只作辅助证据；跨机器重跑维护中的故事和 harness，远程结果以交付 PR 最新 head 为准。

## 笔记集合与正文预览（2026-10-19）

- 新增 NoteCollection 9 个、NotePreview 7 个独立故事，直接使用生产组件、Markdown、CSS 和 ThemeProvider。集合的内存调用方覆盖浏览、键盘布局切换、标签/查询、打开/返回后状态保留、最近/固定、分页、加载/空态/禁用；接收页仅展示真实 NotePreview，不代替 Editor 或真实路由。移动端保留隐藏 Web 工具栏的既有行为，分别验证默认卡片与已保存列表，布局切换仍由 App 外层菜单提供。
- 正文覆盖默认空态、全文展开/收起、文本与完整表格行裁切、标签行去重、隔离 Blob 图片成功/缺失、大图关闭/焦点恢复，以及 H5 表格方向键横向滚动。没有添加外网资产或真实库 fallback。首轮集合测试误点移动端隐藏工具栏与 `pointer-events: none` 的禁用按钮，已按真实能力契约修正；没有改生产 CSS 或绕过禁用状态强制点击。
- 最终 `pnpm verify:design` 通过：83 个故事（74 桌面 1024×900、9 H5 390×844）加 1 项真实断点回归，共 84/84；类型/静态构建、维护表/token 映射、token/icon 与真实 palette 检查通过。原生 Preview 没有新增：这两个组件是共用 Web 内容，应复核 iOS 实际 WKWebView。
- `pnpm verify` 通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，类型/lint/生产构建与全部 bundle 预算通过；保留既有编辑器 Hook 警告和大 chunk 提示。移动首页仍为 1,335,281 / 1,335,296 bytes raw，未提高预算。231 份 Web 源文件、164 份生产产物和 54 份原生源码/资源共 449 份文件逐一 SHA256 与本轮基线一致。
- Storybook 实际 Canvas 手动完成列表切换、产品标签筛选、打开项目计划及返回，列表与标签保留；截图位于本机 `build/verification/note-browser/storybook-collection-*.jpg`。Canvas 仅调整显示缩放为 75%，实际故事视口契约保持。缩放弹层打开时触发的 play 因 iframe body 被 Storybook 设为 inert 而失焦；关闭设置并重置故事后完整 play 成功，不将该次 UI 干扰记录为组件回归。
- iOS 新 Debug 和 Release Simulator 构建成功，保留现有数据容器安装到 iPhone 18 Pro / iOS 27.0。真实 Release App 连接 MemoCard iOS QA 库，实际完成主页列表→原生菜单切换卡片→卡片标签“体验/使用指南”→真实 Editor→原生返回，过滤条件保留；同一筛选再切换列表、打开和返回。最后恢复主页列表与笔记集合卡片。原生搜索另打开“体验 · 卡片内容的节奏”，可见图片与正文；未编辑或保存笔记。实际 App 截图为本机 `build/verification/note-browser/simulator-{home-cards,tag-filtered,opened-note,tag-list,home-restored}.jpg`。
- 首轮手机画面点按失效且顶部/正文未暴露可选节点，用户也确认无法打开菜单；系统 Settings 同样无法响应坐标点按。退出 Device Hub 时选择保留模拟器运行，再重新打开窗口后，系统 Settings 与实际 App 点按恢复，随后完成上述可见验收。未确定底层输入机制的根因，不据此修改 App。临时真实 NativeChrome 根容器 probe 的 4 项命中路由检查通过，仅作为容器路由诊断，不能替代真实触控验收；诊断源码已撤销，快照保留在 ignored 验收目录。
- 验收后 58/58 库文件与 bookmark 保持原样，449/449 生产文件仍与基线一致，已安装 Release 与当前 Release 构建的 170/170 文件匹配。App 数据容器路径与基线不同，不将保留安装表述为路径完全相同。主页由缺省列表变为显式保存 `list`，笔记集合恢复 `cards`，其他已检查存储项未改；这里只确认布局语义恢复，不声称存储字节完全相同。前后快照为本机 `build/verification/note-browser/iphone-{before,after}.json`。
- 首轮 [PR #49 Verify #39236038894](https://github.com/divikwu/memocard/actions/runs/39236038894) 的 design 通过；release 的原生探针在模拟器启动、安装成功后，`simctl launch --console` 超出原 60 秒上限且没有 App 阶段标记，未执行到业务断言。保留失败记录，不将其计为通过；没有延长超时或修改原生探针，最终远程结果以 PR 最新 head 为准。
- 本机日志为 `/tmp/memocard-note-browser-{design-delivery,verify,ios-build,ios-release-build}.log`；定向测试与截图属于辅助证据，未作为可跨机器依赖提交。旧系统、真机、iCloud 同步、大列表性能及所有 Markdown 组合未在本轮覆盖。

实施基线：2026-10-18；工作区原有原生侧栏、Lucide、Preview 与性能用例等未提交变更已保留，快照位于本机 `/tmp/memocard-design-baseline-20261018-122024`。快照和本机截图属于辅助证据，不是可跨机器依赖。

| 检查 | 状态 | 说明 |
| --- | --- | --- |
| token 生成、别名与漂移检查 | 通过 | `tokens:check`、5 项 token 测试；错误类型、别名与只读漂移检查 |
| Storybook 类型、构建、浏览器故事 | 通过 | 19/19 Chromium 故事逐项断言实际尺寸：18 项桌面 1024×900、1 项 H5 390×844；另加 1 项真实断点回归，共 20/20；2 项跨 project 文件过滤不是跳过故事。初版尺寸记录更正见下文 |
| 原生 palette fixture | 通过 | 默认 mono/neutral 浅深色真实 CSS 采样；生成物检查一致 |
| Web/bridge 回归 | 通过 | 最终 60 文件 / 1047 项 UI 测试（单 worker，原超时）；同模式 palette 更新；126 native-core、8 network、14 local-Web、16 MCP 测试 |
| macOS / iOS 构建 | 通过 | 最终生产 Web 资源、Xcode 27.1 / SDK 27.1，Debug iOS Simulator 与 macOS 构建成功；最低部署目标 iOS 17，仅为编译覆盖 |
| Xcode Preview | 通过 | 浅色、深色 AX5、加载 fixture 实际渲染；图标/Text 源码选择与 Live 快捷筛选展开分别验证 |
| iPhone / iPad 模拟器 | 通过已列场景 | iPhone 18 Pro / iOS 27.0：快捷筛选、中文标签搜索、三级完整路径导航、品牌返回主页、设置往返、点击主页面关闭；iPad Pro 11 M5 / iPadOS 27.0：未连接笔记库空态、竖横屏和关闭。未在 iPad 复制真实笔记库 |
| Release 侧栏用例 | 通过 | iPhone 18 Pro / iOS 27.0，4/4，0 跳过；连接现有 QA 笔记库，有超过可见区域的多级标签；独立展开边缘命中、行导航、开合与滚动均执行 |

本机当前可用运行时为 iOS 27.0/27.1。最低部署版本构建兼容性与最低版本实际运行覆盖分别报告；真机、旧系统未实际运行时必须明确保留限制。token 试点不构成帧率、耗电或启动性能改善结论。

Release 用例结果位于本机 `build/verification/design-system/sidebar-tests.xcresult`。本次同时运行构建、浏览器和 Preview，启动测量波动较大；只作为场景执行与行为回归证据，不建立可比较的性能基线，不声称性能提升。

预览证据位于 `build/verification/design-system/`：图标与文字分别点击后定位到 `Image` / `Text` 的源码范围；深色 AX5 使用实际生成 palette，品牌文字保持单行截断；Live Preview 已实际展开快捷筛选。Canvas 的选择定位与源码修改工作流已验证，右侧仍由 Xcode 提供 Inspector，不能视为 Figma 式拖拽编辑器。

macOS 最终 Debug App 实际打开共用 Web 侧栏并验证收起/展开，截图为 `macos-sidebar-final.png`。iPhone 默认外观、中文搜索、iPad 竖横屏截图均位于同一验证目录。

实施阶段 CUA 拖动未完成 iPhone 边缘滑入验收；手势容器源码与实施前基线相同。交付阶段的 XCTest 手势验收见下文。未运行旧系统或真机；远程 CI 以交付 PR 的最新 head 结果为准。

token 无变化的重复构建保留四份生成物时间戳，新增 mtime 回归测试防止无意义触发 Xcode Preview 重编译。

## 最终自动检查

- `tokens:check` / `test:tokens`：5/5；`verify:design` 类型、静态构建、19/19 Chromium 故事、真实 CSS palette 漂移检查全部通过。
- `typecheck`、`lint`、`check:ui-primitives`、生产 UI/MCP 构建、全部 9 个 route 和初始资源/字体预算通过；未提高预算。最紧的移动首页 route 为 1,335,283 / 1,335,296 bytes raw，后续样式新增需关注余量。
- Xcode 工程及 schemes 再次生成后内容一致。
- 同时打开多个模拟器、Preview、并行构建期间的两轮 UI run 出现等待超时并中止，日志保留；关闭模拟器后单独运行 `pnpm --filter @memocard/ui exec vitest run --maxWorkers=1`，1047/1047 全部通过（102.89 秒），未修改 timeout、skip 或断言。其余 native/network/local-Web 与设计验证随后按顺序通过。
- 最终本机日志：`/tmp/memocard-design-quiet-ui-tests.log`、`/tmp/memocard-design-final-native-tests.log`、`/tmp/memocard-design-accepted-preview-verify.log`、`/tmp/memocard-design-ios-accepted-build.log`、`/tmp/memocard-design-mac-accepted-build.log`。这些日志未提交，跨机器请重跑对应命令。

## 交付审查与补验（2026-10-18）

- Web 侧栏／主题桥接与原生实现分别审查，未发现需要修改的生产回归；相关 4 文件 / 25 项 Web 测试通过。10 份 Lucide 矢量资源有效，工程与 3 个共享 scheme 在临时目录重新生成后逐字节一致。
- 修复 Storybook Autodocs 的主题污染：真实 ThemeProvider 会修改 document，故事改为独立 iframe，并为当前场景设置展示高度。真实 Chromium Docs 同时保持浅／深色；LivePalette 切换强调色与中性色不影响其他故事，真实 localStorage/cookie 标记不变，页面错误为 0。类型、静态构建、19/19 故事再次通过。证据为本机 `build/verification/design-system/autodocs-isolation.json` 与 `storybook-docs-isolation.png`。
- 新增 `testSidebarEdgeGesturesOpenAndCloseNavigation`，从闭合状态的左侧 12pt 拖入打开，再拖动右侧主卡片向左关闭；没有用导航按钮替代手势。最终 Release iPhone 18 Pro / iOS 27.0 用例通过（1/1，0 跳过），结果为本机 `build/verification/design-system/sidebar-edge-final.xcresult`，日志 `/tmp/memocard-sidebar-edge-final.log`。此项是实际模拟器 XCTest 行为验收，尚未由 CUA 再次操作复核；Mac 锁屏时不宣称界面工具已完成可见复核。
- 9 个 route／初始资源／字体预算及 Base UI 依赖检查再次通过，未提高预算；`pnpm audit --prod` 未发现已知漏洞。交付阶段没有修改生产侧栏布局或手势实现。

## 架构审查第 1–3 项修复（2026-10-18）

- 初版曾将 Vitest 配置的 1024×900 当作实际执行尺寸；审查确认 addon-vitest 10.6.2 会把未绑定故事视口的测试重设为 1200×900，该历史记录在此更正。现通过共享命名视口与故事 globals 明确 desktop / mobile；19 个故事逐项断言真实 innerWidth / innerHeight，新增 768→767→768→767 浏览器回归。全部 20/20 通过，验证桌面折叠状态保留、移动抽屉跨断点关闭，以及行高／字号 32/14 ↔ 48/16。
- 负向控制将 desktop 视口键临时设为未知值，18 项桌面故事均检测到真实 1200 != 1024；已恢复源码并重新通过 20 项。日志 `/tmp/memocard-review-viewport-negative-control.log`、`/tmp/memocard-review-storybook-tests.log`。
- 可见验收在 600px 窄 manager 确认桌面故事仍为桌面布局；足够的 Canvas 空间下直接读取到桌面 1024×900、H5 390×844。Storybook 10.6.2 manager 的可见高度会受窗口、附加面板和缩放影响，工具栏标注尺寸不能单独作为验收证据。已恢复浏览器临时尺寸覆盖。截图为本机 `build/verification/design-system/storybook-desktop-viewport-fixed.png` 与 `storybook-mobile-viewport-fixed.png`。
- 图标检查新增 `icons:check` 与 5 项回归，覆盖 SVG、Xcode metadata、缺失／漂移只读与 no-op mtime；10 组 / 20 份资源当前逐字节一致，资源内容未改变。已接入 `verify:design` 和现有设计 CI。
- 删除只写不读的 sidebar cookie 与 Storybook cookie accessor 覆盖；42 项 App/sidebar 业务回归通过。palette 采样改用生产 DEFAULT_APPEARANCE；2 项真实 Chromium 回归覆盖已提交 fixture 漂移、缺失／过期检查只读、无变化保留 mtime 与正常更新。Swift fixture 内容未改变。
- 类型检查、lint（既有 LiveMarkdownEditor Hook 警告保留）、生产 UI 构建、Base UI 检查与全部预算通过；最紧的移动首页为 1,335,202 / 1,335,296 bytes raw，余量 94 bytes。没有改动 iOS 源码、原生资源、生产布局或动作协议。本轮远程 CI 结果以 PR #48 最新 head 为准。

## 标签树索引与 iOS 状态订阅（2026-10-18）

- 从 `a53fb0a` 保存旧源码及 Release App，分别建立真实组件 SSR、实际 Swift getter、真实 `NativeHost.handle` publisher 和固定 QA 库 Simulator 基线；前后计时范围、源码指纹、样本与限制见 [performance.md](performance.md)。没有把算法计时或通知次数换算为帧率改善。
- Web 一次建 roots/children/byName 索引与置顶成员 Set；54 项相关回归通过。保留上游顺序、首个同名计数、孤儿/重复路径、平铺搜索、置顶操作和独立展开状态。复杂度回归先在旧实现检测到 80 标签读取 9,800 次，再在新实现通过线性上界，并检查仅选择变化不重读集合。
- Swift 在同次侧栏计算中复用当前 actions 与路径位置索引，不引入跨更新缓存；6/6 回归通过，包括 1,340 路径与旧谓词等价，以及重排、删除、清空和替换。10k 建表加遍历中位数 15,826.353 → 5.210ms 是算法对照，不含 SwiftUI 布局。
- 原生全字典 Host 发布改为每 surface 订阅与小型展示/外观投影。同值重放 100 次不再通知；100 次搜索内容更新只通知搜索本身。真实 bridge probe 通过 42 个独立字段变更及生命周期、实例、picker、主题/palette、展示投影断言，含 1k 标签同值大载荷；已加入 macOS `verify:release`。默认清理临时工程和自身 probe，自建 Simulator 才删除，不静默跳过缺失 runtime。
- 补验生产 `NativeDesignedPanel` 与真实 `UITextField` 的 3 个输入场景：未变化的 Return/失焦事件不再创建覆盖值；真实 pending B 在无关更新和旧回包下保留，确认 B 后能接受 C。冻结未修正优化版在数据已到 UIKit 后仍显示 A，同一 harness 修正后通过；事件发送保留，未引入新输入协议。最终指纹与复跑结果附于 `sidebar-subscriptions.json` 的 `finalValidation`。
- 同一 iPhone 18 Pro / iOS 27.0、同一 QA 库，旧/新 Release XCTest 各 5/5 通过、无跳过，包含开合、边缘手势、展开/行操作分离和滚动前置条件。启动/滚动接近，旧开合基线波动较大；不声称真机、功耗或整体 App 提速。结果位于本机 `build/verification/sidebar-performance/{ui-baseline,ui-current}.xcresult`，便携测量记录已提交在 `design/performance/`。
- `verify:design`（20 项 Chromium 检查）、类型、lint 和生产构建通过；既有编辑器 Hook 警告保留。全部 bundle 预算未增加，最紧移动 route 仍为 1,335,202 / 1,335,296 bytes raw，CSS hash 不变。iOS 控件、布局、手势、资源和动作协议未替换；本次只调整数据索引和订阅来源。完整远程结果以 PR #48 最新 head 为准。


## 组件维护与 Foundations 扩展（2026-10-19）

- 新增 [已使用组件维护表](component-inventory.md)：76 个从 Web 生产入口可达的 TSX 模块，加 7 个原生维护家族，共 83 条。自动门禁校验 Web 模块遗漏、失效/重复记录、必填说明和链接；Swift 家族仍需人工登记。模块可达不代表每个导出组件都已渲染，也不代表所有状态都有独立故事。
- 新增 [token 消费映射](token-consumption.md)：逐一登记全部 27 个可移植 token 的 Web / Swift 消费或不适用原因，并标注别名和仅作基准展示的值；另列动态颜色、字体/排版、图标、阴影/焦点及系统职责。9 个保留的 CSS 颜色角色明确标为尚无生产消费者。校验检查声明与源路径，不冒充运行时消费分析。两组门禁的 10 项正反例测试通过，已接入现有 design / release 验证。
- Foundations 新增颜色、排版、效果三组：真实 CSS 语义色与标签色、实际 TypographyProvider / Typeset 样本、同源 Lucide SVG、现有阴影和键盘焦点；原 tokens 页面补充 spacing 基准。高频基础组件补齐 Button、Input、Textarea、Select、Switch、Tabs、Dialog、Dropdown Menu、Popover、Tooltip、Sheet 共 11 类 / 30 个新故事，使用生产包装，覆盖适用的编辑/禁用/只读/无效、键盘激活、关闭与焦点恢复。未新增底部 Sheet 滑动验收或替换原生控件。
- Storybook 总计 53 个故事（51 桌面、2 H5）及 1 项真实断点回归，共 54 项 Chromium 检查全部通过。新增 Select / Switch / Tabs 的依赖预优化，避免转译后的虚拟故事晚发现依赖而刷新测试页。第一次完整冷启动中既有侧栏三级标签查找曾超时；错误 DOM 截断，未证明具体原因。现有 fixture 在 beforeEach 等待真实标签模块就绪，保留原始超时/断言并增加失败诊断；随后无生成缓存的完整冷启动 54/54 通过，没有用重试或延长等待掩盖失败。
- 可见复核发现新效果故事的 SVG data URL 未加引号，CSS mask 被浏览器丢弃而显示黑块；已修复引用，并增加每个 mask 的 computed style、资源解码及 intrinsic size 断言。实际页面确认 10 个 Lucide 图形正确显示。该问题仅存在于本轮新故事，生产资源未改。最终设计验证另行完整重跑，通过 54/54、类型、静态构建、token/icon 与 palette 检查。
- 可见 Autodocs 原先会并发运行隔离 iframe 的 play，导致焦点争抢。10.6.2 的 iframe 分支忽略 docs.story.autoplay，现使用公开 Story block 覆盖与 Core embed 模式静态展示，Docs 改为只读 ArgTypes；实际手动 Sheet 打开、Escape、焦点返回正常，480px / 844px 高度保留。静态 Docs 的 Primary 隐藏不再适用的缩放工具栏；Canvas Controls、缩放与测试 play 保持；可见操作将右侧 Sheet 的 side 改为 bottom 后确认实际底部布局，再恢复默认值。新 Select 故事曾在首个方向键后仍聚焦初始选项，未取得完整内部时序；现先等待初始选项真正获焦再操作，保留原等待预算与全部断言。
- 本机 `pnpm verify` 通过：1053 项 UI、126 项 native-core 及 network/local-Web/MCP 回归，类型、lint、生产构建、Base UI 与全部资源预算通过。既有编辑器 Hook 警告和大 chunk 提示保留。最紧移动 route 仍为 1,335,202 / 1,335,296 bytes raw，未提高预算。
- 本轮前后 `apps/ui/src` 全部 231 份文件和生产 `apps/ui/dist` 全部 164 份文件逐一 SHA256 相同；Swift、token 值、原生资源与动作协议没有改动。此证据说明本轮没有引入生产产物变化；没有把上一轮 Xcode Preview / iPhone / iPad 验收计作本轮重新运行。
- 本机可见复核确认颜色目录加载、排版按钮使真实正文从 16px 变为 18px 后恢复、Dialog 打开 / Escape / 焦点返回，以及 H5 Sheet 的 390px 宽度；可见窗口会裁剪 Canvas 高度，不以工具栏数字替代真实视口断言。修复后的图标、阴影和焦点截图为 `build/verification/design-maintenance/storybook-foundations-effects.png`。本机辅助日志位于 `/tmp/memocard-design-maintenance-*`；它们未提交，跨机器应重跑命令。
- 未覆盖所有业务组件的独立故事；缺口逐项保留在维护表。iOS 搜索/快速记录独立 Preview、旧 OS / 真机、完整视觉快照及全组件无障碍审计没有在本轮完成。远程 CI 以 PR #48 最新 head 为准。

## 搜索与快速记录交互预览（2026-10-19）

- 新增 6 个搜索、8 个快速记录故事，直接使用生产组件、CSS 与 Markdown。覆盖输入/清空、旧响应拒绝、键盘选择、关闭/焦点恢复、错误重试、分页、标签、内存附件及图片预览、busy 禁用、保存失败保留/成功重置；H5 另含抽屉、草稿恢复和继续页面回调。后者用示例调用方文本框接收草稿，不冒充完整编辑器。
- Storybook bridge 默认拒绝数据操作和资产读取；每故事只安装明确的内存响应与精确路径/binding 的 Blob，结束后清理。4 项门禁测试覆盖默认拒绝、参数转发、旧 cleanup 不影响新 fixture、资产绑定与 reset。实际 Markdown 依赖显式预优化后，无 `.vite` 缓存的设计验证通过；初次依赖重优化导致浏览器中途重载的失败日志保留，不以重试代替修复。
- 本轮 `pnpm verify:design` 已有完整通过：67 个故事（61 桌面、6 H5）加真实断点回归，共 68/68 Chromium 检查，类型/静态构建、token/icon、组件维护/token 映射和真实 palette 检查通过。Docs 的隔离 iframe 按同一 mobile tag 固定宽度；可见实测快速记录 3 个 H5 iframe 均为 390×844，Docs 不自动运行 play，手动保存失败/保留/重试成功及“切换为页面”传递草稿已复核。
- 搜索 Loading 故事先挂起旧空查询，再完成新查询和旧响应。冻结删除生产初次查询 epoch guard 后，同一故事以结果数 4 != 3 失败；恢复原始源码后通过。生产搜索文件恢复前后 SHA256 相同；没有弱化断言、延长超时或保留生产改动。
- 最终 `pnpm verify` 通过：UI 1058、native-core 126、MCP 16、network 8、local-Web 14，类型/lint/生产构建与全部资源预算通过。预览初版完整 UI run 的 5 个既有用例曾出现超时/缺失元素，日志保留；相同源码、原 worker 和超时下，4 个相关文件 200/200 及完整 1057/1057 随后通过。未确定首次失败原因，不宣称已消除环境波动。既有编辑器 Hook 和大 chunk 提示保留。
- 预览初版 `e97a454` 的 Web 源码 231 份、构建产物 164 份前后 SHA256 相同；后续 CI 揭示下面的生产聚焦竞态，最终仅改 `quick-capture.tsx` 与对应测试，CSS/图标/token 和原生布局未变。最终最紧移动 route 为 1,335,281 / 1,335,296 bytes raw，增加 79 bytes、未提高预算。Swift 仅增加 DEBUG 预览接缝和复用生产 overlay 的场景控制，不替换原生组件或动作协议；反馈通过真实 Host 的 instance/presented/action/disabled 校验，图片不回落读取真实笔记库。
- iOS Simulator Release（Xcode / SDK 27.1，arm64 + x86_64）构建成功；产物符号中无 `NativeSurfacePreviewModel` / `NativeSurfacePreviewCanvas`。Xcode 工程重新生成逐字节一致。此项未安装替换现有完整 App，也不把最低部署版本编译覆盖当作旧系统运行验收。
- `pnpm test:native-surfaces` 的真实 Simulator probe 通过原 42 个字段变更、6 个订阅场景、3 个 UIKit 输入场景，并新增 15 个预览边界/取消检查、2 个挂载生产 overlay 的交互闭环。实际 `UITextView.insertText` 逐字输入 `preview`，7 步文本、model ACK 和末尾 caret 均一致。首次图片尺寸与未变化 Return 反馈的失败已在内存 fixture 中修正并复测；输入准备阶段的独立失败记录保留，最终逐字用例直接从已就绪空编辑器开始，没有改动生产输入 setter、ACK 调度或等待预算。
- Xcode 27.1 的 Canvas 实际渲染 Search 默认/深色大字与 Capture 默认/深色大字四个独立入口；本轮 Canvas 自动化未成功完成直接键入，只将其计为渲染验收。iPhone 18 Pro / iOS 27.0 的独立临时内存 App 复用相同生产 overlay/PreviewModel，已可见验证搜索输入/空态/清空/选择关闭/分页/错误重试，以及记录展开、标签搜索/新建、图片预览/关闭、保存失败保留和再次记录成功后重开空白。未写真实库或触发真实系统照片选择器。
- 模拟器界面工具逐键输入曾观察到一次 `previewp`；上面的真实 UIKit 逐字回归未复现，原因未归因。中文查询可见输入与直接 delegate ACK 不等于中文 IME 组合输入已通过。旧 OS、真机、iPad、真实 bridge 保存、权限/picker 和完整布局矩阵仍需针对性 App 验证，不将预览或 ASCII 回归升级为这些覆盖。
- 首轮远程 [Verify #39208585487](https://github.com/divikwu/memocard/actions/runs/39208585487) 的 design 为 66/68：快速记录成功后焦点未恢复，H5 搜索 Enter 回调为 0。本机观测真实 rAF 执行时 textarea 仍 disabled / busy，随后 DOM 才解除禁用；原聚焦无效。新增确定性回归按此顺序先失败，再以一次性 ref + DOM 提交后的 effect 修复，原 Story 的焦点断言与超时保持，24 项组件测试及 8 个记录故事通过。H5 搜索补齐真实查询、输入焦点、选中项/ARIA 提交后再发送 Enter，并增加失败诊断；原始失败现场不足，不能宣称已确认 H5 失败根因。
- 焦点修复后在真实 Storybook Canvas 手动输入并记录，空白输入框恢复 enabled 与焦点，页面显示对应成功回调；截图为 `storybook-capture-focus-fixed.png`。完整设计复跑曾出现既有断点用例 15 秒超时，67 个组件故事通过；原样单独运行断点用例 1/1 通过（1.45 秒）。未修改侧栏、该用例、worker 或超时，原失败日志保留，不以一次单跑通过归因；随后完整 `pnpm verify:design` 复跑 68/68 及 palette 全部通过，日志 `/tmp/memocard-search-capture-focus-design-repeat.log`。
- 同一 run 的 release 通过原 42/6/3、15 guards、搜索闭环和 7 个逐字断言后缺少完成标记：boot 62.040s / install 15.472s / launch 44.947s 均在原上限内，不能记为超时或已通过。仅补 capture 后半段日志、缺 marker 时卸载前的有界生命周期/crash 诊断；正常路径、业务断言与全部 deadline 不变。AttributeGraph cycle 曾出现但后续断言继续通过，没有据此归因。
- 诊断版 harness 在本机 iOS 27.0 全部通过，capture 后半段、cleanup 和最终 marker 齐全，11 份原生源码指纹不变；此结果不能替代 CI iOS 26.5 的缺 marker 原因调查。最终本机结果位于 `/tmp/memocard-native-preview-ci-diagnostics-20261019/`。
- 第二轮 `436f117` 的远程 design 中快速记录通过，H5 搜索前置断言捕捉到分页后的 Dialog 抢焦。真实调用栈表明 Base UI 在分页按钮移除后先微任务、再下一帧恢复 Popup 焦点；受控执行其已排队的原始回调于输入点击之后，准确复现 INPUT → DIV 与原焦点断言失败。故事只新增等待实际 Popup 恢复及该浏览器帧提交，再执行原点击，保留全部焦点/选择/回调断言，不改生产组件、调度或超时；6 项搜索定向验证通过。红绿日志为 `/tmp/memocard-note-search-focus-{controlled-red,targeted-green}.log`，CI 原始现场不足以独立证明同一调用栈。最终帧同步版本的完整本机运行中 67 个组件故事通过，既有断点用例再次 15 秒超时；保留原断言/超时与此前单跑通过证据，不将该次完整命令标为通过。
- 本机截图位于 `build/verification/search-capture/`；生产最终日志为 `/tmp/memocard-search-capture-focus-verify-final.log`，初版设计/原生结果和红绿证据亦保留在 `/tmp/memocard-search-capture-*`、`/tmp/memocard-quick-capture-*` 与 `/tmp/memocard-native-preview-*`。这些辅助文件未提交，跨机器应重跑已维护的故事和 harness。
- 第二轮 [Verify #39209982954](https://github.com/divikwu/memocard/actions/runs/39209982954) 的 release 在 `simctl bootstatus` 原 180 秒上限失败，probe 尚未安装、App 业务断言未运行；UI 1058、native-core 126、Swift 索引 6 等此前阶段通过。与首轮 App 缺 marker 是不同阶段，不合并归因为同一问题，也不延长上限。


## Astryx 风格 Tailwind 语义接口（2026-10-22）

- `theme/tokens.css` 的 `@theme inline` 改为按正文、表面、操作、状态命名：`text-primary` 读取正文色，强调操作使用 `bg-accent-bg text-on-accent`。保留 MemoCard 独立的 state、输入、焦点、侧栏和前景/背景配对，数值仍来自既有 CSS；没有引入 Astryx 包。组件、故事和预览入口同步迁移，原生 palette 键与底层主题声明保持。映射见 [工程文档](token-engineering.md#工具类映射)。
- 与改动前工作区快照逐项比较 102 种可编译工具类组合，除类名外的生成 CSS 一致，包含透明度、hover、focus、dark 和 data 变体；主题源中全部非 `@theme` 声明一致。排版 CSS 的直接颜色读取接回底层变量，防止 `--color-primary` 改义造成正文控件变色。
- 新增 `theme-tokens` Chromium / WebKit 回归，共 66/66：浅深色 × 八种强调色 × 两种中性色的 32 种组合，覆盖 27 个角色、真实 Button / Skeleton、局部状态覆盖和表面阴影。原颜色场景 11/11 通过，保留 22 组配对、原生采样及既有对比度问题断言。
- Token 定义检查与 17 项 token 回归、10 项设计登记回归、Storybook 类型检查、UI lint、生产 UI 与 Storybook 构建通过；UI lint 保留既有编辑器 Hook 警告。资源预算未提高，当前共同工作区的 bundle 检查通过。上述检查不代表真机或完整原生 App 已重新验收。
- 全量 UI 首次为 1100/1101，一项移动端设置返回主页后打开搜索的用例超过原 5 秒上限；未确认原因。原用例单独运行通过，随后以 2 个 worker 完整复跑 68 个文件、1101/1101 通过（142.08 秒），没有改动测试断言或超时。完整复跑的本机临时日志名为 `memocard-theme-ui-tests.log`（不入库）。


## 强调文字 禁用 按压和统一焦点 token（2026-10-22）

- 强调文字改为独立 `--text-accent-color`，默认沿当前 accent-500；操作填充继续读取 --primary。新增禁用文字/图标与 pressed-bg，并登记四项 focus-outline token。公开 CSS 共 310 项，其中非适配层 190 项；所有新角色有实际消费者。
- 迁移 Button、Input、Textarea、Select、Switch、Tabs、Sidebar、关闭按钮、输入框组及编辑器/日期/图片/滚动区域的既有焦点消费者。焦点默认 2px solid、3px 偏移，浅色 accent-700、深色 accent-400；输入框组和快速记录仅由外框显示焦点。文档裁切滚动区按宽度 token 使用内轮廓，强制颜色模式保留 Highlight。
- 禁用颜色同时识别原生 disabled、Base UI data-disabled 和 aria-disabled=true，替换整组透明度；填充按钮/开关使用既有 muted 表面，开关滑块使用禁用图标色。QuickCapture 的不可编辑内容同步 aria-disabled。仍可操作的输入框组附加按钮不受禁用输入染色。按压只添加临时背景图，排除禁用状态，保留选中填充、真实动作和既有动画。
- 主题 Chromium / WebKit 74/74 通过：全部 32 种配色组合，文字/填充分离、禁用文字/图标独立覆盖、单圈焦点与四项 token 覆盖、真实鼠标按下/松开。焦点色相对页面、卡片、浮层及侧栏表面的 128 组配对在每个浏览器均达到 3:1；不将平面色样检查解释为整页无障碍合规。macOS WebKit 以 Option+Tab 遍历按钮，其他环境使用 Tab。
- 新增 Lucide 测试引用曾触发 Vite 晚发现依赖、页面重载和无效 Hook 调用；已显式加入现有依赖预优化，修复后完整主题测试通过。首次 WebKit 原生 Tab 跳过按钮，改为上述平台键盘遍历后通过，没有模拟 focus-visible 或更改业务焦点管理。
- `pnpm verify:web` 完整通过，包括 UI 1101 项测试、MCP 测试/构建、类型、lint、token 与设计登记校验及资源预算。主题/动效/组件浏览器回归共 149 项通过；文档模板与 Chromium/WebKit 排版/密度回归 56 项通过，Storybook 构建与类型/lint 通过。保留既有编辑器 Hook 与构建 chunk 提示。最终首屏 gzip 为 192416 bytes，预算 192512 未改。
- 与本轮前工作区快照逐字节核对 typography scale/生成 CSS、motion token、便携 JSON、圆角派生公式、外观偏好及原生 palette 协议，均未变更。本机临时日志名为 `memocard-interaction-{verify-web,stories,docs-density,storybook-build,design-lint}.log`（不入库）。本轮未重新运行真机/完整原生 App 验收。


## 状态颜色、普通图标与背景语义 2026-10-22

- 新增 18 项语义颜色及对应 18 项 Tailwind 映射：成功／警告／错误的弱化背景和前景、主要／次要图标、通用表面、反色、遮罩、轨道、弱化强调与强调边界。登记为 346 项静态定义，其中 208 项非适配层定义；注册表、消费映射和 Storybook 分类同步更新。All tokens 与 Color 分类共用颜色角色清单，避免新增角色只进入注册表而未显示。
- Alert 与 Badge 新增 success / warning 变体；破坏性 Alert、Button / Badge 迁入 error-muted / on-error。没有将既有信息通知改成成功或警告。浅色成功角色的首轮弱化配对未达 4.5:1，已将新增成功／警告默认值设为既有 green-800 / amber-800，深色用 green-400 / amber-400。Chromium / WebKit 覆盖全部 32 种主题组合，验证状态提示文字与实色 Badge / 破坏性 Button 的指定底色合成对比度均达到 4.5:1；这不是整页无障碍合规结论。
- Select、菜单、输入附属图标、面包屑、关闭控件、搜索／设置／加载提示和格式工具迁入图标角色。新增回归发现破坏性菜单图标的旧 important 声明压过禁用角色；现只给普通变体设置次要图标色，破坏性图标继承状态前景，禁用角色优先。保留显式图标色及填充按钮内容前景。
- Dialog / Sheet、属性确认弹窗、Tooltip、Switch、文本选区和属性复选框分别消费 surface、overlay、inverted、track、accent-muted、border-emphasized。默认值保留既有表面、遮罩 80%、深色轨道 80%、选区 22% 和边界色；真实 Portal 的独立覆盖、Tooltip 箭头、Switch 选中与禁用隔离均有浏览器回归。
- 最终 `pnpm verify:web` 通过，当前共同工作区 UI 1103 项、类型／lint、token／登记、MCP、构建与资源门禁通过；主题／动效／组件浏览器回归 136 项、320px 浅色与 1368px 深色完整 Foundation Docs 回归 2 项通过。Storybook 构建、类型和 lint 通过。保留既有编辑器 Hook、构建 chunk 和 Base UI Collapsible 提示。
- 字号／字重／行高、圆角公式、动效源文件、外观选项和原生 palette 协议均与本轮修改前比对一致。未做原生真机验收。共同工作区同时存在独立 MCP 权限改动及其测试，保留这些改动，不归为本轮 token 迁移。
- 首轮 bundle 门禁在共同工作区测得首屏 192935 bytes gzip，超出原 192512 上限；为新增颜色语义明确增加 1 KiB 首屏 gzip 预留，上限改为 193536。最终共同工作区产物为 192997 bytes gzip；该总量包含并行改动，不作为 token 单独增量。JS／CSS 单文件、路由和字体预算保持。未通过删除功能、降低对比度阈值或延长测试超时通过门禁。
- 日志与冻结值证据保存在 `build/verification/astryx-semantic-colors/`。尚未提交或发布。


## Astryx 持续目标第一批：尺寸、边框与阴影 2026-10-22

- 首批新增 31 项公开定义，注册总数 377、非适配层 219。共用 size-element-xs / sm / md / lg 与 size-textarea-min，根字号基准仍为 24 / 32 / 36 / 40 / 64px；普通边框、方向边框、CSS 边线与分隔线读取 1px border-width。显式零宽、其他宽度、组件留白、图标及命中框保持各自职责。
- 本机编译确认 Astryx bridge 的 --size-* 生成 size-* 而不会生成 h-*，因此另提供 spacing-element-* 映射高度。原类名合并器不识别语义尺寸／内阴影，已登记对应命名；真实控件验证标准类、h-auto、变体和状态内阴影覆盖均有效。
- low / med / high 默认使用原轻控件、表面与浮层阴影，通过 shadow-sm / md / lg 消费；生产 CSS 读取同一 canonical 层级，旧 control / surface / overlay 名称保留兼容别名。属性确认由旧上游 shadow-lg 采用统一 high；快速记录聚焦与底部悬浮角色保持专用值和时序。五项状态 inset 具备实际消费：输入 hover、data-validation success / warning、aria-invalid error 与 outline Button 的 aria-pressed selected；错误优先、禁用不 hover、输入组单层绘制。
- 全部 32 种颜色组合的角色与焦点对比度、真实 Portal 阴影、QuickCapture 桌面／移动浮层、按压／禁用隔离与层级覆盖继续检查。新增错误态检查以真实键盘遍历确认 2px / 3px 焦点 outline 与 inset 同时保留；显式 inset-shadow-none 可覆盖默认反馈。首轮对 disabled:pointer-events-none 输入执行普通 hover 被浏览器命中检查拦截，测试改用真实强制指针定位，没有移除生产禁用规则或延长超时。
- 最终 pnpm verify:web 退出 0：UI 1106 项（69 文件）、MCP、类型／lint、登记／token、构建及资源门禁通过；Storybook 类型、lint、构建通过。主题／动效／密度／组件浏览器回归 177 项，320px 浅色与 1368px 深色完整 Foundation Docs 2 项通过；末次补充错误态键盘断言后，该场景 Chromium / WebKit 两项定向复跑通过（属于上述主题场景，不重复累计）。保留既有编辑器 Hook、大 chunk、MaxListeners 与 Base UI Collapsible 提示。
- 上游阴影参考表与项目实际映射分开；All tokens 与 Sizing 增加实际语义尺寸，Shape 增加边框预览，兼容阴影别名不重复展示。reserved-token 的负向测试从已迁为别名的旧 overlay 族转到有真实生产消费者的 canonical elevation 族，保留原拒绝条件。
- 字号／字重／行高、圆角公式、动效源、外观选项、侧栏 JSON 和原生 palette 协议与批次开始逐项比对一致；没有原生真机验收。本批不修改既有并行 MCP 权限实现。
- 新的度量、默认边框与状态阴影增加共享样式和组件类名成本。原资源门禁触发后，单独登记本批预留：初始 CSS 增加 3 KiB raw，上限 105 KiB；首屏 gzip 增加 1 KiB，上限 190 KiB；共享路由增量增加 6 KiB raw / 1 KiB gzip（叠加原共享预留），各路由基准及字体上限不变。最终初始 CSS 为 107007 bytes，首屏 193922 bytes gzip，所有路由通过。第一次资源失败日志与最终完整门禁日志均保留，不以移除断言或延长超时通过。
- 证据位于 build/verification/astryx-sizing-elevation/。后续目标仍包括公共多色语义、缺失颜色与 bridge 命名、剩余消费／蓝色按钮对比度、领域接口和主题定义／继承／生成；本批通过不代表总目标完成。尚未提交或发布。


## Astryx 持续目标第二批：公共色板、颜色角色与对比度 2026-10-22

- hue CSS 新增十种 Astryx 公共色相与 brown 兼容扩展，每色 background / border / icon / text 四个角色，配套 subtle / ring / icon / vivid 工具类。补齐 on-dark / on-light、tint-hover、shadow、error-inverted 与 border-strong 别名。共新增 99 项定义，当前静态定义 476，非适配层 268；所有上游 64 个 Tailwind 颜色后缀均有对应映射，差集为空。Storybook 的分类页、All tokens 与注册表同步。
- Tag 前景别名接入公共 hue text，背景仍按原透明度派生；九组默认浅深色及原生 tag-* RGBA 与独立旧值基准一致。Callout 在组件作用域把公共 background / text 绑定至原组件 token，保留与 Tag 不同的默认配色；菜单选择、正文和标题、覆盖及保存数据属性均通过真实编辑器回归。cyan / teal 等公共色相未加入产品保存选项。ring / icon 接口以真实 Badge 和图标验证独立覆盖及对比度，不虚构新业务消费者。
- 修复原 blue primary 白字约 3.76:1：填充采用 accent-600，白字保持。强调文字和固定图标独立采用浅色 accent-700 / 深色 accent-400，mono 保留原 accent-500。Chromium / WebKit 全部 32 种主题组合验证真实 Button、链接在 body / card / popover 上达到 4.5:1，图标达到 3:1。十一色弱化背景合成后的文字达到 4.5:1，边框／图标达到 3:1。on-inverted 采用固定 on-dark / on-light；深色前景从原 body 变为纯黑。普通 muted 容器诊断继续单列，不降低阈值。
- tint-hover 继续以原透明度派生 hover / pressed；high 阴影采用项目已有的 color-mix 语法消费 shadow color，默认颜色和几何保持。真实悬停与 Dialog Portal 覆盖已验证。字号／字重／行高源、圆角公式、尺寸、动效源、偏好选项、Callout 数值源、ThemeProvider 与原生 palette 协议源码均与批次开始一致。blue primary 的原生采样随填充修复改变，标签采样与协议字段保持；未进行原生真机验收。
- 完整 pnpm verify:web 退出 0，UI 1106 项、69 文件，以及 MCP、类型／lint、登记／token、生产构建与资源门禁通过。最终颜色／主题／Callout 浏览器 107 项通过，320px 浅色与 1368px 深色 Foundation Docs 2 项通过；末次明确默认标签类名后的十项色板回归复跑通过，属于前述场景，不重复累计。Storybook 构建、类型和定向 lint 通过。首轮测试修正了过渡期间立即取值、错误导入 waitFor 和 Tailwind 的透明 ring 占位层计数，保留生产过渡、组合阴影和阈值。
- 公共色板连同所引用的 Tailwind 色阶带来入口 CSS +8632 bytes、初始 gzip +1162 bytes；当前入口 CSS 115639 bytes、初始 gzip 195084 bytes。为这批颜色单独预留 9 KiB raw / 2 KiB gzip，初始 CSS 上限 114 KiB、gzip 上限 192 KiB；共享路由预留累计 27 KiB raw / 5 KiB gzip，各路由原基准、JS 和字体上限不变。完整门禁通过，原失败与逐路由审计日志保留。
- 证据位于 build/verification/astryx-public-hues/。目标继续保留数据／语法高亮领域接口、主题定义／继承／生成及剩余非颜色接口核对；没有将本批完成当作总目标完成，未提交或发布。并行 MCP 权限改动保持。


## Astryx 持续目标第三批：数据、语法与加载边界 2026-10-22

- 新增 56 项 data 语义角色和 19 项 syntax / diff 语义角色，以及对应 75 项 Tailwind 颜色映射；注册总数 626，非适配层 343。固定上游基准 f94e9622941e4997b0d6af7fc717ccc3d5cefaa6 的全部数据角色及浅深值逐项相同，语法公共后缀差集为空。完整模块提供实际 CSS 值、可编译工具类、渲染示例和独立覆盖；不是只登记名称。
- data.css 按需导入，提供十个分类色、一个中性色和九组五档顺序色。syntax.css 按需导入，提供完整语法与 diff 接口；code.css 单独拥有共用背景，由现有 typeset 加载。Markdown 阅读视图与 RichMarkdownEditor 的 pre 代码块消费新背景角色，浅深色与独立旧表达式基准一致、文本保留且覆盖有效。历史 LiveMarkdownEditor 不在生产依赖图，本批没有修改它，也没有为对齐新增 tokenizer、数据图表或保存选项。
- 语法关键字适配强调文字，混合 5% 正文；comment / punctuation 混合 8% 正文，新增／删除底色使用原状态弱化色的 25%。第一轮 Chromium 浅色 green 的关键字在新增行背景上为 4.4768:1，已在新增语法角色中修复，未改变上一批产品强调色或降低 4.5:1 阈值。两个浏览器的全部 32 种主题组合逐项检查 15 个前景在普通代码及三种 diff 背景上的合成对比度；56 个数据 SVG fill、九组强度递增、独立覆盖与实际背景绑定均通过。数据系列色不作普通文字 AA 承诺。
- 注册表新增明确的 optionalStylesheets 入口，关联示例与浏览器验证；生成器验证元数据、源文件与相对导入的所有权，仍拒绝未登记的不可达定义、已在生产加载却伪装为 optional 的来源，以及未知导入。消费索引继续只统计真实生产图。合并 Tailwind 主题用于依赖分析时移除重复 import，因为所有已登记拥有源已逐份纳入；实际独立编译仍解析真实模块导入。十八项 token 测试覆盖旧门禁、这些负向场景、全部 75 个工具类的独立编译，以及仅加载核心／代码背景时不生成 data 与 keyword 类。
- Storybook 新增 Domain Tokens 分类柱图、强度色阶、代码与 diff 示例；Color 和 All tokens 加入全部领域角色。隔离采样器加载可选模块，确保目录显示真实值而不是继承色回退。320px 浅色与 1368px 深色完整 Foundation Docs 两项通过；Storybook 构建、类型与定向 lint 通过。浏览器新增 RichMarkdownEditor 夹具时发现依赖优化热更新造成 React 上下文错误，已将 Popover 与 react-dom/client 加入预构建后复验，没有延长超时或绕过实际控件。
- 完整 pnpm verify:web 退出 0，当前共同工作区 UI 1106 项／69 文件、MCP、类型／lint、登记／token、生产构建与资源门禁通过。最终组合主题／颜色／领域／Callout 浏览器 177 项通过；末次补充 diff 背景逐项绑定断言后的领域 70 项复跑通过，属于前述场景，不重复累计。最后加强可选模块导入负向门禁后，token 18 项再次通过。
- 第一次把所有语法颜色随普通代码块加载时，一条路由 raw 预算超出。改为共用背景与完整高亮模块分开，最终生产 CSS 中没有 data 或 syntax-keyword 定义，仅有轻量代码背景；入口 CSS 仍为 115639 bytes，初始 gzip 195078 bytes，所有路由通过，未更改任何预算。没有新增运行时依赖、字体或产品状态。
- 主题核心／hue、字号／字重／行高源、动效、圆角及尺寸定义、外观偏好／ThemeProvider、标签／Callout 原值、原生 palette 协议及 bundle 上限与批次开始逐项一致；typeset 的字号、字重、行高、圆角、留白声明一致。没有原生真机验收，独立 MCP 权限／服务改动继续保留。
- 证据位于 build/verification/astryx-domain-tokens/。目标继续包含主题定义、继承与生成，以及剩余非颜色公共映射的逐项核对；本批通过不表示总目标完成，未提交或发布。


## Astryx 持续目标第四批：主题定义、继承与生成核心 2026-10-22

- 新增 defineTheme、生成轴、ThemeStyle 与 ThemeProvider.definition 接入。合并顺序为父主题平面结果 → 本层声明的生成轴 → syntax → 显式 token；子层 color 参数保留父层种子／风格，undefined 不清除继承值。localTokens 按家族继承，定义及轴数据克隆／冻结。生成契约由已登记默认源构建，344 项可写名称、1033 项已知引用；626 项静态 CSS 名称与 13 项偏好／原生输出保持，新增一项主题所有权契约，合计 18 项。
- 颜色轴沿固定 Astryx 基准的 CIELAB 近似 HCT 算法，保留来源与许可，适配 MemoCard 的现有语义角色；没有增加运行时依赖。七种种子覆盖纯黑、白及高饱和色，standard / high 配对均检查文字 4.5:1、强边界／焦点 3:1。neutral-only 不写入强调角色。显式 token 覆盖不自动重算前景，完整配对采用 color.accent。
- 排版轴省略 ratio 时沿现有七档比例，base=16 与旧字号／行高一致；角色保留原字重引用与 4px 网格。radius 只生成基准，七种派生公式保留；motion scale=1 保留原值，reduced 与曲线不由缩放轴改写。这些轴仅在显式应用 definition 时生效，默认主入口继续使用原值与用户偏好，未增加设置选项。
- JSON 构建支持相对 extends、循环检测、自包含 CSS、mtime 保持和 --check 漂移拒绝；运行时与构建共享工厂。ocean 继承 ocean-base，checked-in CSS 纳入 token 测试。工厂拒绝无效 extends、未知字段／token、适配别名、错误形状／数值／引用及通过现有默认表达式产生的环；未静默接受不支持的 Astryx 字段。21 项 Node token／CLI 测试与 22 项新 UI 工厂测试通过，末次补充 null 字体与 undefined 轴参数断言后的 22 项复跑通过。
- Chromium / WebKit 78 项主题定义检查通过：全部 32 种外观组合中运行时与预编译 CSS 的实际组件样式一致；填充／链接对比度、继承的 local token、组件局部覆盖、实例保留、选择器／style 清理、系统深浅色变化、字体偏好优先、显式字号／圆角／时长生成及真实 Dialog Portal 均验证。原生 IOS_PALETTE_KEYS 30 个字段保持，采样 primary 与真实按钮一致；原生观察增加根主题属性，既有发布回归检查仅改变该属性也会刷新颜色。原生自定义非颜色轴的同步边界继续审计，未进行真机验收。
- 完整 pnpm verify:web 退出 0，UI 1128 项／70 文件，以及 MCP、类型／lint、登记／token、构建与资源门禁通过。最终 Storybook 构建、类型、定向 lint 和 320px 浅色／1368px 深色 Foundation Docs 两项通过。主题示例 Canvas 使用独立 iframe。首次主题浏览器夹具未加载原生入口拥有的 tag CSS，字段检查明确失败；补齐真实样式依赖后复验，没有删减协议字段或降低阈值。
- 最初完整契约被 Tailwind 源扫描当作样式表达式，入口 CSS 达 131289 bytes 并触发门禁。已排除生成器／元数据扫描，最终入口 CSS 115710 bytes、初始 gzip 195255 bytes。默认生产依赖图中无完整生成器、HCT 或契约模块；核心样式声明逐项未变。当前路由相对上一批增加 587 raw / 177 gzip bytes，主要为根样式生命周期与原生属性观察；单独增加 1 KiB shared raw 预留，累计 28 KiB raw / 5 KiB gzip，初始、gzip、JS、字体及各路由基准上限保持。原体积失败与逐路由审计保留。
- 核心／hue CSS、排版源和生成默认、动效、外观／阅读偏好、原生 palette 协议、标签／Callout 原值、portable JSON 与生成 CSS 均与批次开始逐项一致。并行 MCP 权限／服务改动未触碰。证据位于 build/verification/astryx-theme-definition/，尚未提交或发布。
- 持续目标仍包括运行时工厂进入生产入口后的消费索引审计、自定义非颜色与原生度量的映射边界，以及剩余非颜色桥接差距与最终逐项完成审计；本批通过不代表总目标完成。


## Astryx 持续目标第五批：生产集成与最终收口 2026-10-22

- 按固定 f94e9622941e4997b0d6af7fc717ccc3d5cefaa6 基准再次逐项审计：79 个核心颜色角色各有 canonical 定义；64 个 Tailwind 颜色后缀差集为空，3 个 element size、1 个 border、4 个 focus 和 8 个 shadow 角色齐全，data / syntax 为 56 / 19 项。其余 spacing、排版、圆角、时长和主题工厂字段均有实现或有依据的保留结论，见 token-engineering 的边界表。没有把未实现的 Astryx 区域主题、StyleX 组件解释器或字号扩展标为已实现。
- font-mono 接入 app-font-mono，默认精确保留原 Tailwind 等宽字体栈；显式 code 轴同时设置界面与笔记代码默认，偏好依旧优先。Skeleton 拆出 skeleton-bg，默认继续引用 accent，实际 Skeleton 独立覆盖不改变 state 选中表面。编辑器属性静态边线与块菜单分隔线的两个遗漏已接入 border-width。登记总数为 629 CSS / 345 非适配定义、13 runtime、28 portable、18 owned；生成契约为 346 可写名称、1035 已知引用。
- 在复制的生产入口真正导入运行时工厂，复现元数据被当作消费者的错误后，将生成契约移入既有 generated 目录；syntax 动态声明通过严格的所有权、表达式和范围契约索引。新回归同时确认真实 reserved 读取、未知引用、缺失／错配／陈旧契约仍失败。隔离入口的消费索引及 Safari 16.4 目标生产构建通过；默认 App 入口与偏好不变，完整生成器仍按需加载。
- 原生显式圆角经 CSS 计算为 px，复用原 rowRadius 字段；真实浏览器验证 px / rem / calc / 0，百分比回退，默认／仅改颜色时保留既有逻辑点偏好。JS 发布回归检查主题启用、值变化及移除后回退；原 IOS_PALETTE_KEYS 和 NativeSurface 协议未改。NativeSidebar 的 Dynamic Type 与 NativeChrome 平台动效沿原所有权，没有新增原生字段或真机视觉验收。
- 运行时构建暴露共用代码背景的 @theme 落入懒加载 CSS，已将共用入口移到核心 Tailwind 编译入口。Docs 采样合并为单个 Tailwind CSS 入口，完整 data / syntax 仍可选，生产不包含其完整默认值。最终生产入口 CSS 115848 bytes、初始 gzip 195348 bytes，全部路由通过；本批没有改变任何 bundle 上限。
- 最终 pnpm verify:web 退出 0：UI 1133 项 / 71 文件，Node token／CLI 23 项，以及 MCP、登记、类型、lint、构建与资源门禁通过。291 项真实浏览器检查覆盖主题、hue、领域配色、动效与相关故事；Storybook 构建、类型和定向 lint 通过，320px 浅色／1368px 深色 Foundation Docs 两项复验通过。新增 Skeleton 首先触发 Docs 定义数量及分组预期失败，已补齐展示和完整预期，没有降低覆盖要求。现有 LiveMarkdownEditor hook lint 与 Base UI 动画提示保留，未扩大本轮修复范围。
- 从第一次迁移前快照核对主入口、排版源／生成默认、两类偏好、原生 palette 与 NativeSurface、portable JSON 及生成 CSS / TS 共 10 份来源均保持；圆角派生公式不变。本批动效、预算脚本不变，核心主题的变化仅为等宽接口和独立 Skeleton 角色。保护证据、上游逐项映射、原始失败与最终日志位于 build/verification/astryx-integration/。并行 MCP 权限／服务改动未触碰，尚未提交或发布。本轮适用项的持续目标已完成；保留差异不作为暗中扩大字号／几何／平台协议的授权。


## Storybook token Docs 优化 2026-10-22

- Docs 根文档和隔离预览的工具栏广播改为读取 Storybook 的 userGlobals，避免把固定 Dark 示例的合并 globals 提升为整个 Docs 的明暗状态。首个真实页面回归复现了工具栏 light、Docs dark；修复后 Default 跟随工具栏，Dark 保持显式深色，主题定义不泄漏到 Docs 根文档。
- Domain tokens 与 Theme definition 启用现有自动高度机制；实际宽屏 Domain 内容及 iframe 均为 989px，消除原 320px 内部截断。补齐同一个 Tailwind 入口的可选 CSS 导入、领域类名用法、语义类名与底层覆盖入口对照，以及完整 defineTheme 继承和 ThemeProvider 应用代码、预编译 CSS 命令与导入方式。
- Colors 诊断的选中前景从不存在的 accent-primary 修正为 accent-foreground。Foundation Docs 删除过时的 blue primary 3.761777718 失败预期，继续要求全部验收配对通过，并明确 primary 至少 4.5:1；未降低阈值。
- 最终 27 项浏览器检查通过：新增两页 Docs 的 320 / 1024px × light / dark 八项，原 Foundation Docs 六项，选定的标准与 Button Docs 字体八项，以及既有示例布局五项。另有八项 Storybook 单元测试通过；Storybook 静态构建、类型、lint、token 生成一致性和设计登记检查通过。此轮未重跑完整 verify:web，也未进行原生真机验收。
- 首次静态矩阵中的 Foundation 六项已通过；新测试有两项在 iframe 重载瞬间读取空 documentElement 而失败。已改为等待 Docs、Default、Dark 三份文档实际就绪并核对模式，随后八项全部通过；没有延长超时、移除预览或缩减断言。
- 与本轮开始快照比对，33 份受保护来源（主题、排版、动效、偏好、原生同步和 manager 导航）内容一致；字号、圆角及动效数值、Sizing 导航策略和生产代码保持。本轮没有触碰并行 MCP 权限／服务修改。原始失败、最终日志、源码差异及可见浏览器截图位于 build/verification/astryx-storybook-optimize/，尚未提交或发布。
