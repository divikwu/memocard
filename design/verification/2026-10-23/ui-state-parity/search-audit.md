# 搜索 UI 同状态源码复核

2026-10-23。范围：旧 `src/components/note-search-dialog.{tsx,css}`、共享 `src/use-note-search.ts` 只读；新版 `ui-next/business/NoteSearchDialog.tsx`、`note-search.css`、搜索测试。已读 `design/ui-next-sidebar10.md`，保留其确认的新 token / Luma / Typeset 差异。没有浏览器、构建、真实笔记库写入或原生端改动。

## 本轮修复

| 位置 | 旧版意图 / 新版偏离 | 最小处理 |
| --- | --- | --- |
| 结果行 | 旧 rounded-lg 结果矩形；新版硬编码 rounded-full，无法跟随设置的圆角 | 使用新版 rounded-element，默认 8px，响应新版圆角偏好；不改变行 padding 或选择逻辑 |
| 关键词高亮 | 旧 primary 15% tint；新版硬换为 yellow 背景，Mono 与其他强调色均无关 | 使用新版 color-accent 15% tint，保留 inherit 文字颜色与 rounded-inner |
| 手机拖拽柄 | 旧 handle 高24 / margin -18；新版另写 margin -12，两端合计多12px；该重复实现也没有 reduced-motion 分支 | 接入当前新版 Sheet 的 swipeToClose，删搜索独立手势 adapter 和五条重复 CSS，复用相同共享手势与新版 token 柄；公共 -18px，与旧间距一致 |
| 预览图片间距 | 旧图片段落 / 多列 figure 上距8px；新版遗漏局部规则，落入 Typeset flow .85em | 搜索专属 CSS 用 spacing-1 × 2 恢复8px，不改共享内容样式 |

保留 Luma 实色 hover / selected（bg-muted）；不恢复旧透明 overlay-hover。保留新版字体、图标、对话框 page radius、Sheet close 最少44px与控件配方。

## 行为逐状态对照

| 状态 / 操作 | 当前结论与证据 |
| --- | --- |
| Web / H5 触发、快捷键与能力禁用 | 共同 App controller 提供 search props；新版只替换渲染。桌面侧栏与 H5 底栏均调用同一 onSearch；Cmd/Ctrl K 的 repeat / composition guard 与旧版共享。WebAppView 仅只读检查。 |
| 首焦点 | 两版均 initialFocus=input；原11项测试与新增 Escape 测试均等到真实 activeElement。 |
| 关闭与回焦 | 两版 finalFocus 相同：preserveSession 时不由弹窗回焦；其余回 connected returnFocus，否则 main header button。新增 Escape 测试验证关闭 reason 与 connected trigger 回焦。 |
| 输入 / composition | 同 useNoteSearch 的 trim、200ms query debounce、空 query 即时最近更新；原测试验证 composing Enter 不打开，普通 Enter 打开。输入法中间输入仍按旧 onChange 逻辑查询，没有另改共享 controller。 |
| 键盘与高亮选中 | 两版同 combobox / listbox / aria-activedescendant，方向键边界 clamp，Enter 要求 active、非 loading、available；同鼠标 pointerMove 选择。 |
| 高亮 | 同第一处 locale-insensitive literal 子串，非正则。新增含 [A]、前后空白与重复命中的测试，验证 query trim 与只标第一处。 |
| Loading | 同 role=status、aria-busy、无可打开结果；新增 pending Promise 测试确认 Enter 不打开，完成后可点击打开。Spinner 继续 aria-hidden。 |
| 空库 / 无结果 | 同“笔记库中还没有笔记”与“没有找到相关笔记”及建议文案；原测试覆盖。 |
| 初次错误 / 重试 | 同 alert 与 retry counter，原测试覆盖错误后恢复。 |
| 连接断开 / disabled | 共享 effect 清结果、停止请求；输入原生 disabled。扩充断开测试确认 input.disabled 与 Enter 无打开行为。 |
| 分页成功 / 竞态 | 同 global query、updatedAt、limit30 / cursor、epoch invalidation；原测试覆盖切词后丢弃旧页。 |
| 分页失败 / 重试 | 新增测试确认保留已加载2条、selected、scrollTop，仍可 Enter 打开；重试同 cursor 合入第3条并清 alert。 |
| Cursor 过期 | 共享 STALE_CURSOR 回到第一页，原测试覆盖。 |
| 日期分组 | 同 today/yesterday/past7/earlier Map，跨页合并组、跨组键盘次序由原测试覆盖。 |
| Coverage | 同未完整读入提示，原测试覆盖。 |
| H5 进入详情再返回 | 两版 preserveSession / searchMounted 由同 controller 控制；原测试确认 query、page、selected、scrollTop 保留且不重复请求。 |
| H5 可见视口 | 同 visualViewport resize/scroll 的 bottom/maxHeight 计算，原测试覆盖。此处为 jsdom 事件，不能代替真机软键盘。 |
| H5 下拖 | 改复用新版 Sheet，既有手势回归继续覆盖 handle 短拖复位、标题下拖关闭、输入与结果拖动不关闭。 |
| 预览交互 | 同 inert 区域；新版 NoteMarkdown interactive=false 与旧 inert 保持只读预览意图；外部“打开笔记”按钮可用。预览错误 alert 传递相同。 |

## 几何 / token 核对与浏览器待验

- 对话框旧新同 height=min(680px,100dvh-2rem)、max-width=min(60rem,100%-2rem)，搜索 field 桌面 px16 / >=640px px20，输入40px高、16px字。
- 旧新同 >=1024px 且 >=480px 高才显示右预览；预览固定公式 `(min(64rem,100vw-2rem)-2px)*.38`，外padding16 / 内padding20、末32px mask。短屏不显示预览。
- 旧新同 H5 90dvh、safe-area padding16、field gap8 / padding0、结果 padding0；handle 修复后高度24 / margin -18。
- 旧预览标题20px/600/1.2，新20px/600/1.4并使用新 heading font；正文 compact 14px与 .85em flow。旧预览正文 h1/h2 局部压到16px，新 Typeset h1=24.5px / h2=17.5px：属于当前已确认新 Typeset 配方，未擅自恢复旧字号。请浏览器检查长标题与带正文标题的预览占高，若产品希望保持更紧的预览，再做局部语义配方决策。
- 需 root 同种子、同视口验收：1440两栏 / 1024边界 / 768无预览、390与320 H5 handle/header/field位置，light/dark和显式强调色高亮，hover/selected/focus-visible，长标题 ellipsis，列表滚动与实际下拖。
- 触发器真实快捷键、返回页滚动恢复、pointer:coarse取消按钮和真实软键盘仍由 root / 真机验收；本报告不以单测代替视觉或系统行为。

## 验证

- 新版 focused 搜索：1 file / 15 tests passed，`search-tests.log`（原11 + 新增4）。
- UI-next TypeScript：passed，`search-typecheck.log`。
- 搜索 TSX / test focused ESLint：passed，`search-lint.log`。
- 未修改旧源码、共享 controller / primitive、WebAppView、Settings、Trash、Editor；未跑共享构建或全量 lint。

## H5 真实浏览器发现后的焦点修复

上述第一轮冻结后，root 在320px真实浏览器同序列对照发现：`搜索全部笔记 → 查询咖啡 → 打开结果 → 返回搜索结果 → 清空搜索 → 退出搜索`，旧版回焦底栏搜索，新版回焦“打开导航”。此实际发现推翻了仅凭相同 finalFocus/controller 代码判断整条 DOM 生命周期无回归的结论。

根因：旧 `src/App.tsx:1000` 的 mobile footer 一直挂载，通过 `hidden={!showMobileRecord || searchOpen}` 隐藏；新版 `ui-next/web/WebAppView.tsx:127` 之前把 `!s.detailView`、home/notes放在 JSX 挂载条件。进入详情时原搜索按钮被卸载，返回后是新 DOM；共享 `searchReturnFocus.current` 指向旧 DOM，`changeSearchOpen` 因 isConnected=false 回退到 main header button。

root 扩展授权后，本轮只将新版 footer 改为手机时常驻，通过 hidden 控制详情、非 home/notes、search。该修复同时避免 QuickCapture 随详情来回无谓重挂；显示几何、组件配方、controller与finalFocus逻辑均不变。既有 `.web-mobile-record[hidden]{display:none}` 有效。

新增 WebApp320集成回归覆盖完整序列，并断言详情期间原 trigger 仍 connected、footer hidden，退出后原 DOM 获焦。先红日志 `search-return-focus-red.log` 精确失败于 trigger.isConnected=false；修复后 WebApp+search 两文件36项通过，`search-return-focus-green.log`。受影响两文件 ESLint通过，`search-return-focus-lint.log`；UI-next TypeScript通过，`search-return-focus-typecheck.log`。未执行浏览器与构建；最终实际回焦由 root 复验。

## 搜索状态夹具隔离修复

root 继续浏览器对照时发现 review-search-error 让整个 notes 页面先报错，无法打开搜索。根因只在本轮验收夹具：`queryNotes` 仅按 limit30 判断搜索，但真实 notes collection 同样 limit30。

`workspace-fixture.ts` 改为 `limit===30 && sort==='updatedAt'` 判定本轮搜索请求，统一用于 review-search 分页 / review-search-loading 挂起 / review-search-error 报错。该判定**仅适用于固定从 #/notes 开始的 review-search* stories**：这里 collection 请求省略 sort，而 useNoteSearch 明确 sort updatedAt；不作为通用生产请求类型识别，也不保证改成 #/home 后仍适用。没有修改生产 controller / 请求格式。

夹具测试使用实际 collection `{query:'',tags:[],limit:30}` 与 search `{query:'',tags:[],sort:'updatedAt',limit:30}`，确认 collection 始终完整6条且无cursor，只有 search 分两页 / 报错 / 保持loading。focused 5项通过，`search-fixture-isolation-tests.log`。

## 用户要求复刻旧搜索后的局部配方修正

用户进一步明确搜索应复刻旧版，使用新 token / components。此前将预览标题行高、正文与各级标题字号差异列为允许新 Typeset 的判断不再适用。以下修正覆盖前文相应保留结论，仍不恢复旧全局 CSS 或改生产 controller。

| 项目 | 已确认旧配方 | 之前新版偏离 | 本次处理 |
| --- | --- | --- | --- |
| 外框 | 实际1px border，960px外宽、958px内容宽 | Luma只绘ring，960px内容宽 | 新Dialog增加border，ring0；仍用新版border/surface/shadow角色 |
| 分隔与预览边线 | 继承主题border | Portal不在.ui-next-theme下，裸border落为currentColor，预览黑线、footer灰线 | root修全局portal border基线；本范围不逐节点掩盖全局缺口 |
| 桌面弹窗圆角 | rounded-xl=旧基数10×1.4=14px | CSS强制radius-page，新基数8×2.6=20.8px | 改新radius-container=8×1.4=11.2px，按新基数保留旧容器角色；预览本已同container角色 |
| 输入焦点 | 业务有data-keyboard-focus条件意图；旧generic Input也会提前绘外框 | 自动聚焦时generic focus-ring盖过业务条件 | root确认后，搜索局部input:focus-visible默认outline:none，仅keyboard flag恢复现有focus token；保留按键捕获/指针清除逻辑 |
| 小字密度 | xs12px/20px，footer45px含border，分组标题40px | TW xs12px/16px，footer41px、分组标题36px | 搜索范围xs使用新supporting-leading=1.6667，恢复20px |
| 预览笔记标题 | 20px/600/24px | 20px/600/28px | 新xl/semibold + 旧局部1.2行高 |
| 预览正文 | 14px/20px、flow .85em、secondary色 | provider新supporting-leading带到14px/23.333px | 搜索显式sm/body-leading，恢复14/20；不改Provider、内容字体偏好或其他正文 |
| 正文h1/h2 | 16px/600/24px | Typeset相对24.5/17.5px及各自行高 | 搜索局部base/semibold/1.5 |
| 正文h3/h4/h5/h6 | h3/h4=14px/600/20；h5=14/500/20；h6=12/500/20 | 全局相对字号/行高占高不同 | 搜索局部sm/xs/semibold/medium/body-leading/supporting-leading |
| code/pre与细节文字 | inlinecode/pre/kbd/figcaption/caption/footnotes14px；code/pre20px行高；sup/sub12px | 新Typeset相对em字号在14px根下再次缩小 | 搜索局部绑定新sm/xs，保留新代码色与字体角色 |
| Markdown结构 | 完整renderer被外层inert禁止交互：链接保留样式、details默认折叠、原生任务框、Mermaid源码+图形 | interactive=false把链接、details、task、Mermaid压为紧凑摘要结构 | 恢复默认新版NoteMarkdown，保留旧同构inert；打开笔记按钮仍在inert外 |
| 结果行 |40px高、旧rounded-lg、bg-state选中、透明hover role | 新rounded-full曾已修；hover仍被替成实色muted | 保留新element圆角/选中muted；hover复用新版overlay-hover角色（新值5%，旧6%，不搬旧值） |
| 搜索专属控件 |32px高/宽，md控制圆角 | Luma默认pill；H5自加44px导致header多12px | clear/open/retry/more/cancel/close统一搜索control md倍率；H5删除自加44，恢复32；SheetTitle600。coarse桌面取消44仍按旧规则保留 |
| 图片 / 拖拽柄 / padding | 图片8px，handle24/-18，field57，preview padding16+20 | 首轮已修，尺寸余下不变 | 保留首轮处理与公共新版Sheet手势，不改页面骨架 |

真实浏览器前后尺寸由 root 测量，以上旧/偏离数值同时用源码核对。本 agent 未调用浏览器。新版颜色、图标、字体、语义圆角基数保持新系统；数据加载、IME、分页/错误/coverage、H5返回会话与焦点逻辑未修改。

新增 `note-search-preview.test.tsx` 用真实Markdown renderer验证链接、默认折叠details、checked且disabled的原生任务框、代码/表格、外层inert与外部打开动作，以及body-only笔记不新增标题。最初测试使用未标准化的URLselector，已改为断言真实标准化URL `https://example.com/`；不把该测试错误说成产品故障。

最终搜索focused：2 files / 17 tests passed，`search-recipe-tests.log`；受影响TSX focused ESLint与UI-next TypeScript通过，`search-recipe-lint.log`、`search-recipe-typecheck.log`。源码已冻结，Web/H5同状态几何、focus、颜色与滚动仍由 root 实测；没有构建或原生适配。

root 后续浏览器确认 field57 / footer45 / preview544 / task正文106.2969均与旧同状态匹配。最后发现预览笔记标题与H5SheetTitle被新版heading-family强制成NotoSerif，而旧搜索这两处沿用UI正文family；本范围又最小改为新body role与font-sans。正文Markdown内部仍保留独立note字体偏好，未回退旧Geist或改其他标题角色。最终像素和交互结论以root浏览器证据为准。
