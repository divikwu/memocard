# Web/H5 新旧 UI 同状态复核

> 历史范围（2026-10-25 标记）：本页保留2026-10-23 的新旧 UI 同状态对照批次，旧端口、源码路径、默认外观及主题 API 不再作为现行维护契约。当前规则见[现行规范](ui-retirement-2026-10-25.md)。被删除的源文件可用 `git show 6214317:<仓库相对路径>` 查看迁移前快照；本机 ignored 证据路径不保证在新克隆中存在。


2026-10-23。**状态：本轮同状态对照、差异修复与浏览器复验完成。** 本页延续 [Sidebar-10 对齐基线](ui-next-sidebar10.md)，核对编辑器、搜索、设置、回收站及卡片/列表；不改变页面骨架、导航结构或原有业务契约。

## 对照方法与基线

旧版使用真实 `src/App.tsx`、旧业务组件与旧样式；新版仍由同一个 App controller 驱动，使用 UI-next 渲染入口和新组件。两套 Story 导入同一个 `createWorkspaceFixture`，对应场景使用相同种子、笔记 ID、正文、路由和操作序列；不拿旧空库和新有数据页面相互比较。

相关入口：

- [旧版 reference Story](https://github.com/divikwu/memocard/blob/6214317638dd5590ddafe1874e943d8ceab8c4ad/apps/ui/stories/sidebar10-workspace-reference.stories.tsx) / [新版 Web & H5 Story](../apps/ui/ui-next/stories/web-workspace.stories.tsx)。
- [共享内存夹具](../apps/ui/ui-next/web/workspace-fixture.ts)：6 条种子笔记；编辑器追加任务、代码、8 列宽表、普通链接、Wiki 链接和长文；回收站种子包含长标题/深路径并固定 deletedAt。加载、错误、异常记录和后台刷新有独立、成对的场景。
- 两版均隔离本次 Story 的 localStorage；刷新、关闭或切换场景会重置，不影响真实笔记库或用户偏好。

| 模块 | 相同 scenario / 初始 route | 可见旧版 | 可见新版 |
| --- | --- | --- | --- |
| 编辑器 | `review-editor` / `#/notes/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee` | [EditorReview](http://127.0.0.1:6006/?path=/story/sidebar10-legacy-workspace--editor-review) | [EditorReview](http://127.0.0.1:6016/?path=/story/ui-next-web--editor-review) |
| 搜索 | `review-search` / `#/notes`，从相同入口打开搜索 | [SearchReview](http://127.0.0.1:6006/?path=/story/sidebar10-legacy-workspace--search-review) | [SearchReview](http://127.0.0.1:6016/?path=/story/ui-next-web--search-review) |
| 设置 | `loading` / `#/settings`，相同已连接库 | [SettingsReview](http://127.0.0.1:6006/?path=/story/sidebar10-legacy-workspace--settings-review) | [SettingsReview](http://127.0.0.1:6016/?path=/story/ui-next-web--settings-review) |
| 回收站 | `review-trash` / `#/trash`，相同 2 条记录 | [TrashReview](http://127.0.0.1:6006/?path=/story/sidebar10-legacy-workspace--trash-review) | [TrashReview](http://127.0.0.1:6016/?path=/story/ui-next-web--trash-review) |

附加成对 Story 后缀为 `search-loading`、`search-failure`、`trash-loading`、`trash-failure`、`trash-issues`、`trash-refresh`；不能将这些独立场景的故障结果套用到正常场景。

保留 Sidebar-10 槽位、新 token、字体偏好、基础圆角 8px 和新版组件。业务模块按旧实现保留各自的密度与层级，不能直接套用通用 Luma Card、Dialog 和 Typeset 的默认外观。搜索与卡片标题继承新版 UI 正文字体角色；笔记内容继续使用独立内容字体偏好。圆角随新版角色与用户设置变化，不导入旧全局 CSS 或旧组件。

`review-search*` 场景都从 `#/notes` 开始；夹具仅将带 `sort: "updatedAt"` 的搜索请求分页或注入错误/加载，普通列表保持完整 6 条，避免列表故障冒充搜索故障。

## 本轮差异与修复

| 模块 / 状态 | 发现的问题 | 最终处理 |
| --- | --- | --- |
| 编辑器标题与属性 | 新 flex gap 使标题→属性变为桌面20px/H5 16px；标题额外上下 padding4px；H5正文间距变为28px | 恢复 block sibling 关系，标题→属性8px、属性→正文32px；标题仅保留原有inline inset8px。错误提示群32px、相邻提示8px和手机保存状态8px使用新 spacing token表达 |
| 编辑器链接类型弹层 | Select portal 挂到 body 后失去 next-rich-ui 祖先，H5选项44px规则不匹配 | 仅给编辑器 SelectContent adapter 补样式作用域，保持 portal、选择、取消、选区和回焦逻辑 |
| 编辑器禁用格式操作 | 原生扩展格式按钮未经过新Button，禁用项仍像可用项，且 hover 着色 | 接入 text-disabled/icon-disabled；hover 排除 disabled；不改动作权限判断 |
| 编辑器宽表格 | 共享TableView仍支持键盘和水平滚动，新CSS遗漏溢出提示与focus框 | 恢复“左右滚动查看完整表格”、提示自身 fit-content 宽度和focus token；保留共享溢出探测及ArrowRight滚动能力 |
| 搜索结果 / 高亮 | 结果行硬编码 pill；高亮硬编码 yellow，脱离当前强调色 | 结果行使用 radius-element；高亮使用 color-accent 15% tint及原文字色，保持同一处literal子串命中逻辑 |
| 搜索H5 / 图片预览 | 自写手势adapter造成handle多12px间距，遗漏 reduced-motion；图片段落/figure间距落入正文flow | 复用新版Sheet手势与公共柄，恢复原handle布局；搜索专属图片上距8px |
| 搜索→详情→返回→退出 | 新版条件渲染卸载H5搜索触发器，returnFocus指向脱离DOM节点，最终回焦导航按钮 | H5底栏保持挂载，仅用hidden控制详情、页面及搜索状态；保留原触发器DOM，修复退出搜索回焦；QuickCapture也避免无谓重挂 |
| Portal默认边框 | base边框样式只命中主题容器后代，弹层在body Portal，预览框/分隔线回退为currentColor黑边 | 独立新版样式入口为所有元素与伪元素设置新border角色，显式状态边框仍可覆盖；恢复原字体平滑基线 |
| 搜索专属配方 | 通用Input焦点规则覆盖业务自动聚焦意图；Dialog缺真实边框；预览、底栏行高和标题家族漂移；默认遮罩及阴影过重 | 自动聚焦无框，键盘路径继续显示focus token；真实1px边框、标题20/24、正文14/20、正文h1/h2 16/24、底栏45px；恢复随背景变化的80%磨砂遮罩和旧阴影几何，全部引用新token |
| 搜索Markdown预览 | 非交互摘要renderer把链接、details、任务和Mermaid扁平化，偏离旧预览结构 | 恢复完整新版NoteMarkdown renderer与外层inert，保持只读预览，不改变搜索打开行为 |
| 卡片/列表外观 | 直接继承Luma的大圆角/较重阴影，标题强制heading家族，摘要套用正文标题级差，头部/标签区域密度漂移 | 保留新Card/Badge，恢复320px最小列宽、256px卡高、16px网格间距、轻阴影、默认16px业务圆角；摘要14/20、flow .4em、标题与正文同大小、标签20px、日期12/20；列表恢复紧凑行及原元数据断点 |
| 卡片点击 | 预览的position/opacity层盖住打开按钮的扩展区域，点击正文留白不打开 | 非交互预览透传指针，继续使用原打开按钮；标签保持独立交互层，不添加外层click处理 |
| 只读任务标记 | 字体字符☐/☑的尺寸与旧16px任务框不一致 | 新token表达16px框和勾选图形；完整Markdown保留disabled checkbox，摘要用无交互span，保留摘要无button/input/tabIndex契约 |
| 设置文件状态 | 计数标签省略单位、行距变8px、宿主授权说明混为同一文案 | 恢复完整对象名称、12px行距、16px列gap及本机宿主/浏览器/原生说明；保留零值、时间未知/缺失处理 |
| 设置能力与反馈 | MCP说明丢失保持主客户端运行/不开放永久删除，working缺中文状态 | 恢复完整能力说明与中文role=status；能力和working禁用逻辑不改 |
| 设置内容风格 | 窄屏标题按钮组换行后失去原右侧归位；预览标签字重遗漏 | 局部margin-inline-start:auto及medium字重；保留七项内容偏好、随机/重置、持久化键与真实预览 |
| 设置排版adapter作用域 | Web排版CSS加载后驻留Storybook，离开Provider仍可能影响独立业务Story | Provider生命周期维护document作用域标记，adapter以标记为前缀；覆盖同document portal，卸载后恢复独立Story的Typeset配方；不新增布局节点 |
| 回收站标题与卡片 | 多出header说明，默认Card内距24px使列表密度偏离；H5动作方向/断点改变 | 恢复单标题+刷新、旧header留白、section16/list8、卡片上下12/左右16、内容8/动作12；恢复<=640px内容列排及动作左置，保留新版Card视觉 |
| 回收站初读 / 刷新 | 初次只有2个整块占位；已有数据刷新丢busy/中文状态 | 恢复3条结构化卡片skeleton，能力控制删除动作占位；刷新保留2条可读记录，aria-busy及sr-only中文status不引起列表间距跳动 |
| 回收站空态 / 错误 / issues | 空态丢Card容器与h2；裸错误p丢操作上下文和异常记录解释 | 用新版Card/Empty及真实h2；复用新版PageNotice恢复“回收站操作未完成”“部分回收记录无法读取”及记录保留说明 |
| 回收站预览 | 宽度变768px、正文最小高缺失、H5footer列反向 | 恢复720px/viewport−32px、正文min80px、右侧行排/窄屏换行和完整只读说明；沿用弹层自身滚动，不增加内层滚动容器 |

编辑、属性、搜索、恢复、删除及保存行为仍复用原共享core/hooks。未新增批量清空、额外导航或新业务流程。回收站永久删除在浏览器只检查既有逐条确认并取消；取消不得产生删除调用。

## 相同状态浏览器检查

以下为 root 在实际浏览器执行的检查；尺寸/行为与单测证据分开记录，最终JSON和截图由root归档。

| 范围 | 已实际检查 | 结果 |
| --- | --- | --- |
| 编辑器桌面 / 390px H5 | 相同富正文、标题/属性、属性菜单和链接类型；宽表溢出提示、ArrowRight滚动；修改、撤销、重做、保存、离开重开读回 | 两端间距8px/32px；属性/链接可达，表格滚动与焦点行为可用；正文及业务交互保留 |
| 搜索1440 / 1024 / 768 / 390 / 320px | 同弹层、预览显示边界、关键词高亮；初页2条→加载更多6条；查询“手冲”、进入详情、返回保留会话 | 无横向页面溢出，视口对应布局和数据一致；结果、分页、查询及返回行为保留 |
| 搜索320px退出回焦 | 搜索全部笔记→查询→打开结果→返回搜索结果→清空→退出 | 实际发现后直接修复；最终静态构建浏览器复验回到原底栏搜索触发器，非只依赖同名DOM或单测 |
| 设置1440 / 390 / 320px | 相同已连接库、本机文件状态展开、高级外观展开、内容字号选项、实时预览及重置 | 字段可达、窄屏无撑宽；内容字体设置与UI字体独立，选项及重置生效 |
| 回收站1440 / 390 / 320px | 相同2条记录；长标题/深路径、预览及Escape、永久删除确认后取消、恢复2→1→0与空态 | 卡片/动作/弹层可达，取消不删除；恢复成功移除对应记录并显示空态 |
| 回收站refresh / failure / issues | 已有2条时刷新busy；读取失败保留上下文；异常记录说明 | 刷新保留2条列表；失败/异常notice及重试入口可见，未清空已有数据 |
| 首次loading / 搜索错误 | 回收站初次骨架、搜索loading/错误/重试；Web Escape关闭与H5拖拽关闭 | 中文反馈和重试入口可见；加载中可退出；两版手机拖拽后回到原搜索入口 |
| 搜索补充复刻 | Web相同6条结果、相同选中笔记；390/320px同关键词；进入、返回、退出 | 边框不再回退黑色，输入区57px、预览高度544px、底栏45px与旧版一致；任务正文高度106.296875px一致；相同H5入口完整链路均回焦搜索按钮 |
| 卡片/列表Web与H5 | 相同6条种子；卡片/列表切换；卡片正文留白原生指针点击、标签独立筛选、手机菜单切换与键盘打开 | Web卡高256px/间距16px；390px卡宽358px、320px卡宽288px，正文与标签坐标一致；手机列表均44px且隐藏元数据；点击留白打开同一ID，标签筛到同一条记录 |

浏览器静态Storybook曾偶发 `Failed to fetch dynamically imported module`；相同源码冻结后在6006/6016开发Storybook补验。该中间加载异常保留为本地预览证据边界，不据此宣称业务回归或production故障；构建通过也不自动代表全部浏览器状态验收完成。

## 自动化与构建

[仓库内精选证据](verification/2026-10-23/ui-state-parity/)保留本页引用的成对截图、浏览器 JSON 和四份审查记录。原始日志位于本地 `build/verification/ui-state-parity-20261023/`，不入库；下列日志名用于说明本次验证来源。本轮统计以最终全量日志为准，不累加与focused重叠的测试。

- 新版最终回归：38 files / **296 tests passed**，`final-tests.log`。
- 旧版相关回归：6 files / **247 tests passed**，`legacy-tests.log`。旧测试环境的`Window.scrollBy not implemented`提示保留，不是浏览器滚动验收结果。
- TypeScript通过：UI-next及旧reference Story相关检查，`final-types.log`、`legacy-story-types.log`。
- 完整ESLint：0 errors，7项既有warnings，`lint-final.log`；未扩大本轮修改范围去清理旧警告。
- 最终UI-next补充ESLint无错误/警告，`final-lint.log`；最终TypeScript、测试与构建进程退出码均为0。
- 独立新版Web、最终新版Storybook和旧版reference Storybook构建通过：`final-web-build.log`、`final-storybook-build.log`、`legacy-delivery-build.log`。构建chunk体积提示保留，未混入本轮UI差异修复范围。
- 有价值的新增回归包括：链接portal scope及取消/回焦/选区/零写入；搜索literal高亮、读取pending禁止打开、分页失败保留结果与重试；H5搜索真实触发器DOM保留及完整返回序列；文件状态/能力保护；回收站初读/刷新/失败/删除取消与重复提交；Web排版Provider及portal卸载后的样式隔离。

详细发现时的源码报告保持原始待验描述，最终关闭状态以本页最终浏览器段落为准：

- [editor-source-audit.md](verification/2026-10-23/ui-state-parity/editor-source-audit.md)
- [search-audit.md](verification/2026-10-23/ui-state-parity/search-audit.md)
- [settings-trash-audit.md](verification/2026-10-23/ui-state-parity/settings-trash-audit.md)
- [collection-recipe-audit.md](verification/2026-10-23/ui-state-parity/collection-recipe-audit.md)

## 最终证据

[浏览器状态与几何记录](verification/2026-10-23/ui-state-parity/browser-evidence.json)。其中保留了动画未结束、视口切换前后及修复前观察；以包含 `replica` / `final` 的稳定复验记录判断当前结果。最终截图按CSS视口取样，避免Retina截图缩放或页面长内容影响对照。

| 相同状态 | 旧版 | 新版 |
| --- | --- | --- |
| Web搜索，6条结果，首条预览 | [旧版](verification/2026-10-23/ui-state-parity/search-replica-web-old.png) | [新版](verification/2026-10-23/ui-state-parity/search-replica-web-new.png) |
| H5搜索，390px，同关键词 | [旧版](verification/2026-10-23/ui-state-parity/search-replica-h5-390-old.png) | [新版](verification/2026-10-23/ui-state-parity/search-replica-h5-390-new.png) |
| Web卡片，同6条种子 | [旧版](verification/2026-10-23/ui-state-parity/collection-replica-web-old.png) | [新版](verification/2026-10-23/ui-state-parity/collection-replica-web-new.png) |
| H5卡片，390px | [旧版](verification/2026-10-23/ui-state-parity/collection-replica-h5-390-old.png) | [新版](verification/2026-10-23/ui-state-parity/collection-replica-h5-390-new.png) |
| H5卡片，320px | [旧版](verification/2026-10-23/ui-state-parity/collection-replica-h5-320-old.png) | [新版](verification/2026-10-23/ui-state-parity/collection-replica-h5-320-new.png) |
| H5列表，390px | [旧版](verification/2026-10-23/ui-state-parity/collection-list-h5-390-old.png) | [新版](verification/2026-10-23/ui-state-parity/collection-list-h5-390-new.png) |

浏览器保留成对搜索面板与成对卡片列表：搜索均为1440×900、空查询、6条结果且选中首条；卡片Storybook画布均为1024×900、同6条数据且收起addon面板。临时静态验收服务6017/6018/6019已停止，原6006/6016/5180服务保留。其余编辑器、设置与回收站逐状态截图及原始日志保留在上述本地 `build/verification/ui-state-parity-20261023/`，不入库。

## 验收边界

- 本轮写入仅发生在隔离内存夹具；没有连接或写入真实vault，没有把mock保存/恢复/删除称为文件系统验收。
- H5使用桌面浏览器的320/390px视口和真实键盘/指针事件；不替代iOS真机软键盘、系统文件选择器、原生手势与safe-area实机验证。
- iOS/Mac原生重新适配仍后置。本轮没有安装替换客户端、发布或合并操作。
- 保存版本/hash/vault binding及竞态继续由共享业务与定向回归保护；本轮UI对照不能证明真实跨进程、跨库或系统附件picker完成验收。
