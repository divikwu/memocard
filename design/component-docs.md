# 组件使用文档

组件描述参考 Astryx 的用途、组成和使用建议；Button 页面进一步对齐 [Astryx Button](https://astryx.atmeta.com/components/Button) 的 Overview、Properties、Accessibility 分页结构。示例参考 [shadcn Button](https://ui.shadcn.com/docs/components/base/button) 的实际预览和使用代码。文档描述 MemoCard 现有契约，保留默认外观、Base UI 包装与 iOS 系统组件。

## 试点入口

| 组件 | Storybook Docs | 生产接口来源 |
| --- | --- | --- |
| Button | `components-button--docs` | `apps/ui/src/components/ui/button.tsx` |
| Input | `components-input--docs` | `apps/ui/src/components/ui/input.tsx` |
| Dialog | `components-dialog--docs` | `apps/ui/src/components/ui/dialog.tsx` |
| Note Search | `business-note-search--docs` | `apps/ui/src/components/note-search-dialog.tsx` |

在 Storybook 地址后添加 `?path=/docs/<入口 ID>`，或从组件侧栏打开 Docs。Input、Dialog、Note Search 的布局由 `apps/ui/.storybook/component-docs.tsx` 维护，组件说明和最小代码随各自 `.stories.tsx` 保存。Button 使用 `apps/ui/.storybook/component-docs-template.tsx` 的通用分页模板，组件内容仍由 `apps/ui/stories/button-docs.tsx` 维护；其他组件按需接入，不提前迁移。组件归属、覆盖状态与验收入口仍在[维护表](component-inventory.md)维护，不新增一份组件注册表。

## 通用组件文档模板

`apps/ui/.storybook/component-docs-template.tsx` 提供以下共享部分，样式在同目录的 `component-docs-template.css`，使用现有组件库和系统 token：

- `ComponentDocsTemplate`：接收 `name` 和 `overview`、`properties`、`accessibility` 三个 React 内容区，统一标题、简介、页签、排版与章节间距。Properties 保持挂载，切换页签时保留临时参数状态。
- `ComponentDocsProperties`：共享预览 / 代码切换、Reset、反馈区域及参数表。调用方传入 `name`、`preview`、`code`、`parameters`、`onReset`，按需提供 `feedback`、`resetLabel` 和参数表前的说明内容。每条 `ComponentDocsParameter` 包含名称、类型、必填标记、可选默认值、说明和可选 `control` 渲染函数；控件直接接收生成的 `id`、`aria-labelledby`、`aria-describedby`，继续使用现有 Input / Select / Switch。未提供控件的行只读。组件只保存代码开合状态，参数值、点击计数和重置逻辑由调用方持有，Reset 不改变当前预览 / 代码状态。
- `ComponentDocsExample`：接收 `title`、`story`（Story ID）、`code`、`description` 和预览内容；使用隔离 `<Story>` 时传入 `iframe`。统一预览卡片、描述 / Code 切换和代码复制；“在 Canvas 中打开”只在 Docs 中显示。
- `ComponentDocsSource`：可独立使用的代码卡片；外层圆角、边框、背景、字体和语法颜色使用系统 token。TSX / Copy 工具栏位于顶部，代码占满内部宽度，只有代码区域滚动；嵌入示例卡片时沿用外层圆角，避免重复边框。保留 Storybook 高亮，复制使用现有 Button 的 ghost / sm 样式，提供成功和失败反馈。鼠标点击代码不显示焦点边框，键盘聚焦使用 `--ring` 提示并保留滚动能力。
- `ComponentDocsMarkdown`：保留 Storybook 的链接、标题和代码处理，将表格放入可键盘聚焦的局部滚动区域，统一圆角。
- `ComponentDocsBestPractices`：接收 `items`，每条 `ComponentDocsPractice` 使用 `guidance: "do" | "dont"` 和 Markdown 字符串 `description`。复用现有 Badge 展示“推荐 / 避免”，沿用共享表格的描边、圆角、字体和间距 token；标题由调用方在文档流中提供。窄屏保持两列，说明与长英文完整换行，不引入独立滚动。Button 和模板展示页在 Overview 的“组成”之后共同使用；接入代码演示通过现有 `overview` 内容区组合，不增加模板参数。
- `ComponentDocsStandalone`：独立 Canvas 两侧增加 `4 × --spacing`（默认 16px）；Docs 内或 `embed=true` 的 iframe 直接沿用外层留白。

在组件 CSF 的 `parameters.docs.page` 组合模板；需要在工具栏主题更新时保留页签和参数状态的页面使用 `component-docs-renderer.ts` 的 `componentDocsRenderer`。Button 是完整接入示例。模板只负责文档展示，不声明具体组件 API，也不引入额外的组件注册表。

独立展示入口位于 **文档模板 → 通用组件文档**，ID 为 `component-docs-template--docs`，源码为 `apps/ui/stories/component-docs-template.stories.tsx`。页面展示三页签、表单预览与代码、模板参数和接入示例。内部 Example 保留测试及 Canvas 直达能力，从侧栏隐藏；不复制 Button 的整套文档内容。

### Storybook 的 Noto Sans SC 字体

Storybook 在 `.storybook/preview.tsx` 的 `parameters.appearance` 统一将标题与正文字体默认设为 `noto-sans-sc`；标准 Docs、通用文档模板和隔离示例共同消费现有 `--font-heading` / `--font-sans` token，Docs 主题也通过 token 提供说明与 API 表字体。组件自己的 `parameters.appearance` 和显式 Storybook `headingFont` / `bodyFont` globals 可以覆盖默认值。应用的默认值继续为 Geist；已保存的字体选择不迁移、不覆盖，Storybook 仍使用独立的临时偏好存储。字体菜单的分组与标签由 `font-groups.ts` 随设置页加载，首屏偏好校验只消费 `FONT_VALUES`，避免把菜单标签打进初始依赖。外观设置保留独立的 **Noto Sans SC** 和原有仅拉丁资源的 **Noto Sans** 选项；代码的 `--font-mono`、笔记排版和原生系统字体保持现有配置。

资源来自锁定版本的 `@fontsource-variable/noto-sans-sc@5.3.1`。`font-loader.ts` 仅在选中该字体时动态导入 `wght.css`，本地 WOFF2 按包内 `unicode-range` 分片，由浏览器根据页面字形按需请求；不使用 `FontFace.load()` 预加载整套中文子集，也不请求第三方字体 CDN。字体声明使用 `font-display: swap`，资源尚未到达或离线失败时沿用现有系统回退栈。字体包的 OFL 许可随构建复制到 `public/licenses/noto-sans-sc.txt`。完整可选 SC 资源单独限制为 5 MiB，原有拉丁字体及首屏 JS/CSS 预算保持不变。

`pnpm --filter @memocard/ui test:storybook --project docs-fonts` 自动启动已构建的 `storybook-static` 临时服务（首次运行前执行 `pnpm --filter @memocard/ui build:storybook`，也可用 `STORYBOOK_FONT_TEST_URL` 显式指定服务），在独立浏览器会话回归两个页面的三个页签、320px / 390px、明暗模式。测试延迟字体请求后释放，以及对字体请求返回网络断开错误（页面基础资源保持可用），验证实际平台字形来源、按需子集、无第三方字体请求、40px 页签间距、整页宽度、长标题、参数控件、预览 / Code、原生剪贴板读回和 Reset；截图及结果默认输出到 `build/verification/docs-fonts`。断网场景验证已启动页面的字体回退，不表示整站支持离线首次安装。`ThemeSettings.test.tsx` 另行回归新增选项、保存 / 重挂载和旧用户偏好保留。 静态构建验收可在构建完成后用 `pnpm --filter @memocard/ui exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6007 --strictPort` 启动服务，在另一终端以 `STORYBOOK_FONT_TEST_URL=http://127.0.0.1:6007` 运行该测试。

同一测试项目也覆盖其余 10 个基础组件（Dialog、Dropdown Menu、Input、Popover、Select、Sheet、Switch、Tabs、Textarea、Tooltip）：每个组件在 320px / 390px、明暗模式、延迟加载 / 字体断网下验证标准 Docs、嵌入的主示例和独立示例的实际平台字形、整页宽度及嵌入宽度；有 API 表时也验证表头字体，代码块继续使用等宽字体。显式 Geist 选择另行验证不下载 Noto。动态 CSS 注册后再等待 `document.fonts.ready`，避免把短暂的系统字体回退误判为最终字体。标准 Docs 在窄屏沿用 `4 × --spacing` 侧边距，API 与 Markdown 表格保留自己的横向滚动区域，长行内代码允许换行，不撑宽整页；Tooltip 示例的操作行也允许自然换行。现有 Storybook play 测试继续覆盖各示例的完整交互。

Storybook 的 `body.sb-show-main` 使用 `min-width: 0`，允许 Docs 中小于 320px 的内嵌画布跟随容器；生产页面的最小宽度保持原配置。Tabs 默认变体的示例列表在空间不足时局部横向滚动，Line 变体不增加滚动裁切，保留其下划线。

浏览器回归关闭文件并行，并按 `sequence.groupOrder` 顺序运行各项目：现有组件交互先运行，Docs 布局及两个窄屏宽度随后运行，字体矩阵最后运行，避免字体隔离会话与首次渲染、截图测试同时争用浏览器资源；保留现有超时边界。

Button 的 `ButtonProperties` 和模板展示页的 Properties 都接入 `ComponentDocsProperties`。Button 保留原参数、图标策略、预览与点击反馈；模板页保留标题编辑、“恢复默认标题”和四项真实 API 说明。`name` 行通过 `control` 插槽展示现有 Select，可选择默认标题、Button、Input；上方 Input 支持自由编辑，选择器以“自定义标题”表示其他值。两种控件共享同一个标题状态，并同步到页面标题和接入代码，不增加模板 API。共享样式使用 `component-docs-properties-*`，不再维护 Button 专属的 Properties 布局样式。

参数表滚动区域使用 `--border` 描边和 `--radius` 圆角，Props 标题位于描边外；表格内部保留行分隔线，末行去掉下边框，避免与外框叠加。窄屏时描边固定在容器边缘，仅内部表格横向滚动。

`ComponentDocsExample` 和 `ComponentDocsProperties` 共用内部预览卡片头：标题保留在文档流，代码按钮使用现有 Button 的 ghost / icon-sm，绝对定位在右上角。顶部及右侧留白为 `2 × --spacing`，标题右侧预留 `14 × --spacing`，包含按钮宽度、外侧留白和标题间距；长英文及中文允许完整换行，内容区随标题高度下移。示例卡片的顶部按钮与底部描述 / Code 页签共享状态，预览、Canvas 和复制交互继续保留。320px / 390px 明暗模式回归同时检查两个实际共享组件的长标题、按钮留位及键盘切换。

Markdown 参考表同样由滚动容器承担外框；四列及以上的表格使用 `--container-2xl`（默认 672px）最小宽度，避免窄屏逐字换行。两列表格保留自适应。Properties 内嵌代码复用预览框的描边和圆角，移除内层 Source 外框；独立代码卡片保留原有外框。Prism 的所有语法文字均由系统颜色 token 覆盖，包括函数名、运算符和标点，避免固定浅色主题的语法颜色泄漏到深色背景。

`pnpm --filter @memocard/ui test:storybook --project component-docs-template-320 --project component-docs-template-390` 在实际 320px / 390px 视口回归长英文标题的整页宽度、完整换行、跨页签与主题切换后的保留，并检查控件使用系统字体、后续章节保留 40px 间距和首标题不叠加间距。

同一回归覆盖独立及嵌入示例的代码卡片，在明暗模式检查工具栏与代码分离、滚动区域左右贴合卡片内缘、单层滚动、系统圆角和颜色、复制成功及失败反馈和整页无横向溢出。使用原生浏览器输入回归鼠标点击不显示蓝框、Tab 后显示键盘焦点和 PageDown 滚动。代码最大高度使用 `88 × --spacing`（默认 352px），桌面和窄屏沿用同一规则。

`button-docs-320` / `button-docs-390` 与 `component-docs-template-320` / `component-docs-template-390` 在实际 320px / 390px、明暗模式下回归两个共享面板：编辑值与代码同步、隐藏预览退出导航、Reset、跨页签和主题切换后的参数及代码开合状态、参数表局部滚动与整页宽度。Button 额外验证 Select、Switch、禁用状态和点击反馈；模板页验证标题编辑、预设 Select 的键盘选择及 Escape、状态同步和完整 API 行。回归同时检查语法文字对实际代码背景达到 4.5:1、Properties 内层代码无重复外框、多列表格的可读列宽及滚动后外框位置。

## Button 分页与侧栏

页签复用项目的 `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`，使用 `TabsList variant="line"`。Line 沿用上游 base-nova 的 3px 列表内边距、32px 横向列表高度和 500 字重，下划线使用标签底部 -5px 定位；横向间距按本地规范统一为三个 `--spacing`（默认 12px），纵向间距仍为 4px；标签左右内边距为半个 `--spacing`（默认 2px），上下仍为 2px。此规则应用于所有 Line Tabs，包括文档主页签、描述 / Code 和独立示例，不设置断点；默认变体和交互契约保持现有实现。文档只维护系统字体、列表外边距与章节间距，不再单独覆盖示例页签高度。

按默认 16px 根字号，列表下边距 `8 × --spacing`（默认 32px）与 Tabs 的 8px gap 合成到内容面板的 40px；面板首元素不叠加顶部 margin。章节标题使用上 `10 × --spacing`（默认 40px）、下 `4 × --spacing`（默认 16px），紧邻章节标题的子标题取消额外上边距，保留 16px 层级间距。Markdown 内部段落/列表、预览框内部及 iframe 布局保持原规则。

- **Overview**：六种现有变体总览 → 用法 → 组成 → 最佳实践 → 示例。最佳实践按“推荐 / 避免”说明当前 Button 的使用边界。示例展示八种现有尺寸、图文按钮、禁用状态和通过 `render` 组合的真实链接。独立按钮预览居中，代码默认收起；每个故事在对应区域展示一次，不新增按钮 API。
- **Properties**：同一个隔离 iframe 内放置真实生产 Button 和一组参数行。每行列出名称、类型、默认值、说明与可操作控件；`onClick` / `render` 只读。CSF 与参数行共同消费 `apps/ui/stories/button-docs.data.ts`，避免另列重复的 API 表。该故事单独使用 `fullscreen`，预览框和参数表左右与外层说明对齐；独立 Canvas 两侧使用 16px 留白，预览框内部及表格单元格沿用系统间距。点击计数仅用于观察示例回调，图标与文字编辑限制明确标为预览策略。
- **Accessibility**：按键盘与焦点、可访问名称、禁用/链接语义及颜色状态列出说明，链接真实 Foundations 诊断与验证记录；保留已知颜色对比度缺口，不将键盘回归当作整页或所有配色的 AA 证明。继续提供原有键盘与禁用故事及平台职责说明。

所有 Button 文档示例与实时参数预览共用通用模板的 `ComponentDocsExample` / `ComponentDocsSource`：默认收起，展开后显示 TSX 高亮与复制按钮。静态示例提供完整生产使用代码，动态代码与当前参数保持一致。Storybook 的代码主题 Provider 仅包裹代码高亮区域，生产组件继续使用原来的主题 Provider。

Properties 面板在当前 Docs 会话中保留挂载，切到其他页签再返回时保留参数、点击反馈和代码开合状态；隐藏面板仍退出键盘与无障碍导航。Reset 重置参数和计数，页面刷新重新开始会话；不使用真实 localStorage 持久化演示状态。

Canvas 的 Variants 隐藏被固定示例覆盖的 `variant` / `children`，Sizes 隐藏 `size` / `children` / 部分生效的 `aria-label`；固定键盘与禁用场景关闭 Controls，Default 保持可编辑；Properties 使用文档内置的参数行。生产参数表及 Button API 不受这些示例配置影响。

Button 侧栏只保留 Docs、Default、Variants、Sizes、Keyboard And Disabled。Overview、Properties、Anatomy、States、Loading、Examples、Actions 标记为 `tags: ["!dev"]`，作为 Docs-only 故事保留嵌入、原有直达 URL 和自动测试；不再提供重复侧栏入口。独立 Examples 等 fullscreen 故事通过 `ComponentDocsStandalone` 补齐两侧间距，嵌入 Docs 时不叠加。

Sizes 在 Docs 中沿用现有自然高度观察器，窄容器换行时增高，变宽后回缩；居中展示不再要求固定 iframe 高度。其他固定高度示例及主题、数据隔离保持原规则。

只对齐文档的信息结构和展示方式。Button 继续使用 MemoCard 已有六种变体、八种尺寸及生产样式，不照搬 Astryx 的属性命名、组件外观或额外功能。

## 其他试点页面顺序

1. **用途**：一句话说明组件解决的问题与使用范围。
2. **默认示例与用法**：先显示一个实际可操作的场景，附最小完整使用代码。代码包含真实 import、必要状态和回调，不包含 fixture 安装或测试断言。
3. **组成**：必要子组件、标签和可选区域。
4. **使用建议**：选择、组合与不适用场景；仅列与该组件有关的规则。
5. **变体与状态**：沿用其他 Story；首个示例不重复展示。没有独立变体时不制造新的状态。
6. **API 与组合契约**：说明本地组件增加或改变的接口、必填项与实际默认值。常用继承属性列出必要项，其余链接 DOM 或 Base UI。
7. **交互与无障碍**：键盘、关闭、焦点、可访问名称及错误反馈。
8. **平台差异**：Web、H5 与 iOS 的职责和原生 Preview 入口，说明本页的验证边界。

## API 和示例参数

- Button、Input 的参数表以生产组件源码为准；显式维护常用参数，避免自动推导遗漏组合类型。列表不宣称覆盖全部继承 DOM 属性。
- Dialog、Note Search 的生产接口通过组合契约或生产参数表说明；Storybook 包装器的参数单列为“示例控制项”。`onSave`、`initialOpen` 等示例接口不作为生产组件接口发布。
- Controls 只开放对当前故事真实生效的参数。初始化值、内部受控值和回调仍可列在文档中，但不提供会误导使用者的控件。
- 示例回调与内存数据只说明交互结果，不能表述为真实保存、真实笔记库读取或原生验收。
- 修改生产接口时，在同一改动中更新该组件的说明、参数表、使用代码与相关 Story；复用上游接口链接，避免抄录整份第三方 API。

## 展示和验证

Docs 复用现有隔离 iframe，不自动执行 `play`，开发者可手动操作；Canvas 和 Vitest 继续执行完整交互检查。Button 的参数控件在故事内部维护临时状态，无需跨 iframe 同步。需要适应内容的故事显式启用 `docs.story.autoHeight`，按同源自然内容根尺寸调整 iframe 高度；Properties 隐藏后再显示也应恢复内容高度，文档卸载时清理观察器，其他故事继续使用既有固定高度。业务故事保留实际桌面/H5 视口及原有数据隔离。

执行 `pnpm verify:design` 验证类型、静态构建、故事交互与设计维护门禁，再在真实 Docs 检查：说明与代码可按需查看、首故事只展示一次、参数表准确、示例手动交互与回调有效。Button 额外检查一组参数行、跨页签保留参数及同一 iframe、隐藏面板语义、代码初始收起/高亮/真实复制读回、Reset、图文/禁用/真实链接，以及内容展开和窄布局下的高度与溢出。自动测试的 clipboard spy 仅证明调用；不能代替真实浏览器复制读回。对照检查未迁移的 Docs，确认其内容与隔离行为保持。

`pnpm --filter @memocard/ui test:storybook --project button-docs` 持续验证真实 Docs 页签、参数/计数/代码开合状态保留、隐藏语义、键盘跳过及 Sizes 的实际换行高度。夹具在首次渲染后通过 `vi.dynamicImportSettled()` 等待真实 Source 高亮模块，并在 `act` 内提交，再开始状态交互断言；不以延长 DOM 等待或替换 Source 模块规避加载。测试复用公开的 Storybook DocsRenderer 与真实 CSF，仅将 iframe 装载边界换为隔离的 `about:blank` fixture，不访问 Storybook 服务；它不替代生产 iframe 启动或实际 Docs 页面可见验收。

文档模板沿用现有组件与排版 token；Tabs Line 的间距按上述本地规范调整，字体设置新增可选 Noto Sans SC，应用默认字体、原生组件与交互协议保持不变。可见验收、自动回归和 CI 结果分别记录在[验证记录](validation.md)中。
