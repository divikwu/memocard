# 设置与回收站同状态对照

2026-10-23。本轮按 `design/ui-next-sidebar10.md` 保留 Sidebar-10 页面骨架、新 token、Typeset 与 Luma 配方；只在新版设置/回收站与其测试内修复有旧源码证据的遗漏。旧 App、旧设置/Trash、共享 useTrash/TypographyProvider 均未修改；未操作浏览器、未运行共享构建、未连接真实笔记库。

## 已修复差异

| 同状态 | 旧实现依据 | 新版问题与本次最小修复 |
| --- | --- | --- |
| 连接笔记库 → 展开文件状态 | `src/App.tsx:940`、`StatusRow:1015` | 新标签“已索引/待读取/需要处理”省去了计量对象，行距8px而旧12px；恢复“已索引笔记/待读取文件/需要处理的文件”、12px行距/首尾无多余padding、16px列gap、secondary dt。新 `WebSettings.tsx:37`、`web-settings.css:27`。零值、有效/无效/缺失时间不丢失。 |
| 本机宿主与浏览器文件夹 | `src/App.tsx:928` | 新描述统一成“你授权的文件夹”，丢失宿主授权来源；按相同 CSS-free client-mode 区分本机宿主/浏览器/原生说明。新 `WebSettings.tsx:35`。 |
| Mac MCP 正常/更新中 | `src/App.tsx:950–954` | 新说明丢“保持主客户端运行”和“不开放永久删除”；working 时无旧中文更新状态。恢复完整范围说明与 `role=status`“正在更新连接…”，装饰Spinner隐藏。新 `WebSettings.tsx:54`。权限与working禁用仍由原state控制。 |
| 设置内容风格标题行在窄屏换行 | `TypographySettings.tsx:29` 的 `ml-auto` | 新按钮组换行后回到左侧；新增局部 margin-inline-start:auto，保持旧右侧归位。新 `WebTypographySettings.tsx`、`web-settings.css:5`。预览“实时预览”补回原 medium 字重。 |
| 回收站默认header | `src/components/trash-page.tsx:26`、`src/trash-page.css:4–6` | 新增了不属于旧业务的header说明段落；恢复单标题+刷新，左/下8px、gap12px、small刷新按钮，保留新版字体与Button配方。新 `TrashPage.tsx:20`、`trash.css:1–3`。 |
| 回收站列表与卡片密度 | `src/trash-page.css:1–4,13–14`、旧卡片 `px-4 py-3` | 新section gap20/list12/Card默认24px内距/内容4px/动作4px；恢复16/8、卡片12×16、内容8px、动作12px。用新版Card spacing变量，不导入旧CSS、不移除新Luma阴影/圆角。新 `trash.css:4–16`。 |
| 回收站H5卡片动作 | `src/trash-page.css:19` | 新<768动作右排且强占全宽；旧<=640为内容列排、动作自然左置。恢复原断点与方向，长标题/路径仍单行ellipsis/full title；手机几何由Root验收。新 `trash.css:21`。 |
| 回收站空态 | 旧Card + `.trash-empty` + h2 | 新裸Empty丢Card容器且EmptyTitle默认div，padding48px四边使H5正文更窄。恢复新版Card容器、真实h2、48×24px内距，保留新Empty媒体/字体/圆角配方。新 `TrashPage.tsx:24`、`trash.css:17`。 |
| 回收站初次读取 | `LoadingTrash:49–57` | 新只有2个整块灰条；恢复3条与真实卡片相同的内容/动作结构，占位按永久删除能力显示。中文status与装饰aria-hidden分开。新 `TrashPage.tsx:23`。 |
| 回收站已有数据时刷新 | 旧刷新aria-busy + sr-only读取状态 | 新缺aria-busy，且装饰Spinner会产生英文Loading播报。恢复aria-busy与中文status；后台status本身sr-only，避免新增0高grid item导致间距跳动；列表继续可读。新 `TrashPage.tsx:20,23`。 |
| 回收站失败/issues | 旧 `PageNotice` 标题/图标/role | 新为裸p，丢操作上下文与部分记录解释标题。复用已有新版 `business/PageNotice`，恢复“回收站操作未完成/部分回收记录无法读取”；失败仍保留原记录及刷新重试。新 `TrashPage.tsx:21–22`。 |
| 预览长正文/H5底部操作 | `src/trash-page.css:16–18` | 新宽768px、body无80px最小高、H5 footer列反向。恢复720px/viewport−32px、body min80px、右侧行排并允许窄屏换行；弹层本身滚动，无新增内层滚动容器。新 `trash.css:18–20`。恢复完整“此内容只读…”说明与旧日期格式。 |

## 保持而未重复重构的契约

- 七项Typography偏好仍使用原存储键、解析、选项与Provider；真实NoteMarkdown/Tiptap/标题/代码字体/行宽映射维持上一轮接线，UI字体独立。
- 所有保存失败提示、随机/重置、跨tab和编辑器undo保持；新版外观默认Noto/Luma/8px不变。
- `useTrash` 未修改。整卡打开、恢复/永久删除独立、listed/reviewed hash、vault binding、重复提交保护、失败保留和关闭回焦不变。
- 旧版无“批量清空回收站”功能，本轮不新增；“清空确认”对应已有逐条永久删除确认，取消不得调用读取/删除接口。
- 不把原生Base UI Switch当HTMLButtonElement；它以aria-disabled表达禁用，测试验证真实点击被阻止。

## 集中验证

`settings-trash-focused.log`：4文件 / **32项通过**（WebSettings 4、TrashPage 5、WebTypography 4、既有WebAppearance 19），最新09:41:01运行。包括：

- 文件状态计数单位与零值、同indexedAt、无效/缺失时间、长vaultName完整title、展开后Tab顺序。
- 切换/创建库独立动作，working/editor/unsupported guard；本机宿主与浏览器说明。
- Mac MCP与本机Web能力分支、旧只读关闭动作、working中文status、真实禁用点击。
- Trash长标题/深路径提示与CSS契约；初次3条skeleton、刷新busy/status、刷新失败保留旧卡、重试进入Card空态h2；issues说明。
- 预览Enter、读取中禁恢复、失败说明、Escape回焦。
- 永久删除先取消、无意外预览请求、重复点击仅一次、pending阻止Escape/取消、失败留弹层、重试使用相同listed hash/binding。
- 既有内容偏好与外观独立、真实Tiptap实例与undo保持、持久化失败/跨tab/随机/重置。

`settings-trash-typecheck.log`：UI-next TypeScript noEmit通过。`settings-trash-lint.log`：仅本次相关TSX focused ESLint通过。没有运行全量lint、共享build、旧测试套件或浏览器；旧共享业务控制器未改。

## 交给Root的同状态可见验收

Root已提供两版同名SettingsReview/TrashReview及Loading/Failure/Issues/Refresh入口。本任务未改fixture。

1. 设置：1440/390/320；长vaultName截断不撑页面、展开文件状态的4项字段对齐、Tab焦点完整；高级外观/七项内容风格长选项不撑宽，滚动后预览/重置可达。MCP pending用focused state验证，不把它称为真实服务写入验收。
2. 回收站：同seed/固定deletedAt；桌面内容与动作同一行、<=640列排动作左置；Card左右16/上下12、list8、section16；新字体可能影响最终行高，不用jsdom声称像素相同。
3. 320长标题/深路径ellipsis与全文提示，卡片padding可打开，恢复/删除独立；footer右排，720px预览在320为288宽，长正文滚动后关闭/恢复可达。
4. Loading/Refresh：首次3条结构化placeholder；已加载列表刷新时不插额外间距、busy与状态有中文名称；失败保留记录且刷新可重试；issues仍解释原记录保留。
5. 永久删除只打开确认后取消；不使用浏览器实际删除。读取失败、禁用与焦点回位可看fixture，真实hash/vault保护由共享hook与focused契约覆盖。

以上是源码及focused验证结论，不替代Root的同页面/同种子/同状态浏览器最终结果。

## 最终diff复核：适配器作用域（已修复）

发现并修复 P2：`web-typography.css` 原先直接命中全部 `.note-markdown-next.typeset-memocard`。Storybook访问Web页面加载CSS后，再进入独立业务Story，Provider虽已卸载，驻留CSS仍会覆盖Typeset移动端原始1.125倍字号及宽度。该问题不影响实际Web偏好目标，但会让独立业务Story依赖访问顺序。

最小修复：`WebTypographyProvider.tsx:7–10` 在Provider生命周期增删 `documentElement[data-web-typography]`；五组笔记adapter selector加该前缀（`web-typography.css:2–21`）。同document的Portal仍受控；无新增布局节点、无全局Typeset默认修改。Web预览专用结构类本来已局部，不扩大选择器。

新增真实NoteMarkdown+React Portal回归：独立渲染无adapter → 挂Provider时inline与portaled搜索预览实际CSS契约生效 → 卸载Provider后字体/字号变量消失且max-width恢复渲染前值。与原四文件一起运行，`settings-trash-scope-focused.log` 为 **4文件/33项通过**；scope typecheck/lint日志无错误。未构建、未操作浏览器。

复核未发现本轮Settings/Trash修复新增的其他P1/P2：刷新busy/error/空态条件仍来自同一useTrash；恢复成功后的记录移除/通知/重新读取未改；窄屏恢复的方向/密度仅作用于next-trash类，设置规则仅作用于web设置类。真实窄屏几何/滚动仍以Root浏览器验收为准。
