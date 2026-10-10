# 内容页优化验收 · 2026-10-09

## 本轮范围

- 长标题改为自动增高的文本域；保持 Enter 转入正文、命令 Enter 保存、组合输入保护。
- 粘贴标题中的换行归为空格，不改变笔记正文或 Markdown 格式。
- 桌面输入时弱化块按钮；悬停、键盘聚焦、打开块菜单时保持可见。
- 点击正文列下方的页面空白，将光标放到文末；不自动插入段落，不接管按钮或只读模式。
- 将已有 720px 独立居中、32px 标题和统一左边缘布局同步到真实服务。

## 已验证

- `pnpm verify` 中类型检查、lint、UI 360 项、MCP 16 项、Swift 核心 34 项、原生网络 8 项、本机 Web 9 项及生产构建通过。
- lint 仍有原有 `LiveMarkdownEditor.tsx:508` Hook 依赖警告，未修改无关代码。
- 最终 CSS 微调后，Editor 与 RichMarkdownEditor 的 94 项测试再次通过。
- `pnpm build:service`、`pnpm install:service` 和安装脚本签名校验通过；`git diff --check` 通过。
- 模拟 gallery 笔记：长标题桌面高度 117px，390px 窄屏高度 232px；未截断、无横向溢出。标题、标签容器、正文共用左边缘。
- 模拟页输入后按钮透明度 0.25，悬停、键盘聚焦及菜单打开为 1。
- 点击正文下方空白，输入落在最后一段末尾；导航至列表再打开，模拟数据仍保留标题与正文修改。
- 桌面与 390px 窄屏、浅色与深色布局均检查；验收后恢复浅色，清除视口及媒体模拟，关闭临时标签页。
- 真实服务保持原端口 56561 和原笔记库 `service-acceptance-vault-2`。刷新后标题与正文均从 x=492 至 x=1212，宽 720px；主区中心 x=852 与正文中心一致。标题字号 32px，正文最小高度 240px。
- 真实笔记“测试”的标题和正文显示内容在升级前后保持一致；本轮未对真实笔记执行输入或保存测试。
- 模拟页控制台无 warning/error。

## 未通过的既有体积门禁

`pnpm verify` 最后在 `check:bundle` 失败：初始 CSS 为 89,290 字节，预算为 87,040 字节。复制工作区到独立临时目录并移除本轮新增标题样式后的对照构建为 89,245 字节，仍超预算；本轮初始 CSS 增量为 45 字节。未放宽预算或清理无关样式。

## 未实测

- 原生中文 IME、触摸操作、长距离拖拽/拖拽取消、跨段落选择。
- 本轮真实服务磁盘写回、服务重启与重新授权；模拟保存不等于真实目录持久化。

## 恢复与证据

安装替换前的应用和 CLI 备份：`/tmp/memocard-service-backup.8yJTjW/`。未删除或移动任何笔记库、授权记录或用户未提交文件。

模拟长标题截图：`memocard-content-polish-verified.jpg`。真实服务最终截图：`memocard-content-polish-service.jpg`。

## 独立标签字号调整 · 2026-10-09

- 仅包含有效标签与空白的正文段落增加展示装饰，字号为正文的 87.5%；标签使用现有 muted-foreground、常规字重，无底色或边框。句中标签不变，代码、链接和纯数字不误判为标签。
- 新增测试覆盖标签段落识别、添加正文后恢复普通样式、撤销恢复及 Markdown 原文保持不变。UI 361 项及其余自动化、构建通过；完整 `pnpm verify` 仍在既有初始 CSS 体积门禁失败，数值未变（89,290 / 87,040 字节）。
- 模拟页与 390px 窄屏确认独立标签 14px、句中标签 16px；导航返回后样式与内容保留，无横向溢出。
- 真实服务临时页确认正文 16px、`#写回验收` 14px、字重 400、透明底色，控制台无 warning/error；服务已构建安装并通过签名校验。
- 未刷新用户当前正在编辑的另一篇笔记，也未编辑真实笔记。本轮未重复深色模式、真实磁盘写回或 IME/触摸/拖拽测试。
- 安装前备份：`/tmp/memocard-tag-service-backup.cbHoN6/`；截图：`memocard-tag-size-verified.jpg`。临时验收标签页已关闭，视口恢复默认。

## 正文标签统一 · 2026-10-09

- 取消编辑器属性标签区，标签索引只从正文生成；不迁移旧属性标签，读取或保存均不把旧属性补回正文。原文件 YAML 字节仍保留，不批量改写已有笔记。
- 正文开头、句中、结尾的同名标签去重；删除最后一次出现后，卡片、侧栏和筛选不再保留该关联。标签筛选下新建笔记直接把标签写入正文。
- 类型检查、UI 362 项、MCP 16 项、Swift 核心 35 项、原生网络 8 项、本机 Web 9 项、构建及 `git diff --check` 通过。完整 `pnpm verify` 仍在既有 CSS 体积门禁失败：89,235 / 87,040 字节。
- 新版本已构建、安装并重启服务，同一测试笔记库的地址变为 `http://127.0.0.1:56616/`。Chrome 已授权页面确认旧属性区消失；独立测试笔记“正文标签验收”完成正文输入、保存、导航重开及最后一次标签删除后的索引消失验证。未改动其他笔记。
- 内置浏览器的旧授权在重启后失效，未将未授权空页作为数据验收；临时未授权页已关闭。未单独读取真实库磁盘文件，本次真实重开证据不能替代磁盘逐字节核验。
- 未重复窄屏、深色模式、原生 IME、触摸、拖拽或跨段落选择验证。应用及 CLI 备份：`/tmp/memocard-body-tags-service-backup.wPcI67/`；真实服务截图：`memocard-body-tags-service.png`。

## 中性灰胶囊标签 · 2026-10-09

- 正文标签保留 ProseMirror 文本装饰，仅修改视觉：14px、常规字重、圆角胶囊、1px 6px 内边距，使用现有 muted / muted-foreground。卡片标签复用 Badge secondary 的原生按钮，12px，保留点击筛选及键盘焦点，不加删除按钮。
- 自动化 UI 362 项、MCP 16 项、Swift 核心 35 项、原生网络 8 项、本机 Web 9 项及构建通过；新增卡片 Badge 属性断言后 UI 362 项再次通过。`git diff --check` 通过。完整 `pnpm verify` 仍被既有初始 CSS 门禁阻挡：88,991 / 87,040 字节，未放宽预算。
- 已构建安装至本机服务，保留 PID 50577 的既有监听与授权，没有重启或启动构建副本。内置浏览器真实库确认正文标签14px、卡片12px，背景 rgb(248,248,248)，内边距 1px 6px。
- 390px 窄屏 scrollWidth 与 viewport 都为390，无横向溢出。临时将页面根类改为 dark 检查深色标签，随后恢复 light；没有修改保存的外观设置，临时视口也已清除。
- 真实笔记“正文标签验收”临时输入后撤销，再导航重开，正文与验收前完全一致（包括用户新增的 `/测试`）。卡片标签点击筛选只返回一条笔记，控制台无 warning/error。
- 未逐字节核验真实磁盘文件，未实测原生 IME、触摸、拖拽取消或跨段落选择。备份：`/tmp/memocard-tag-badge-backup.XVty1Z/`；截图：`memocard-tag-badge-editor.png`、`memocard-tag-badge-cards.png`、`memocard-tag-badge-narrow.png`、`memocard-tag-badge-dark.png`。

## 固定浅蓝标签 · 2026-10-09

- 正文、卡片和筛选标签改用固定 Tailwind blue-50 背景、blue-600 文字，不引用主题 accent / muted。字号、胶囊形状、编辑和筛选行为不变；卡片悬停文字使用固定 blue-700。
- 真实服务正文、卡片、筛选标签均测得背景 `oklch(0.97 0.014 254.604)`、文字 `oklch(0.546 0.245 262.881)`。临时把后台验收页设为 green + dark，标签色值保持完全一致；恢复 mono + light 并关闭临时页，未修改用户保存的外观设置。
- 390px 窄屏无横向溢出，正文14px、卡片12px；导航重开正文保持不变，控制台无 warning/error。本轮为颜色调整，没有重新执行真实输入、磁盘逐字节、原生 IME、触摸、拖拽或跨段落验收。
- `pnpm verify` 类型检查、lint、UI 362 项、MCP 16 项、Swift 核心35项、网络与 Web 测试、构建通过，仍在既有 CSS 门禁失败：89,140 / 87,040 字节。服务构建安装及签名校验通过，原监听与授权未重启。
- 备份：`/tmp/memocard-tag-blue-backup.PFuneZ/`；截图：`memocard-tag-fixed-blue.png`、`memocard-tag-fixed-blue-cards.png`。

## 固定青色标签预览 · 2026-10-09

- 用户要求查看青色系，正文、卡片和筛选标签统一改为固定 cyan-50 背景 / cyan-700 文字，卡片悬停 cyan-800，不改变全局主题、字体或笔记内容。
- 真实库正文14px、卡片12px，背景 `oklch(0.984 0.019 200.873)`、文字 `oklch(0.52 0.105 223.128)`；深色测试色值相同。390px 窄屏无横向溢出，临时视口和根类已恢复，控制台无 warning/error，导航重开正文与变更前完全一致。
- UI362项及其余验证测试、构建通过，完整 `pnpm verify` 仍在既有 CSS 门禁失败（89,140 / 87,040 字节）。本机服务构建安装通过，没有重启或启动副本；备份：`/tmp/memocard-tag-cyan-backup.gOwNXH/`。
- 此轮只调整颜色，未重复真实输入/磁盘逐字节、原生 IME、触摸、拖拽取消或跨段落测试。截图：`memocard-tag-fixed-cyan.png`、`memocard-tag-fixed-cyan-cards.png`。

## 固定天蓝标签预览 · 2026-10-09

- 用户要求试天蓝色系，正文、卡片和筛选标签改为 sky-50 底 / sky-700 字，卡片悬停 sky-800，不跟随主题色，不修改其他外观设置。
- 真实正文14px、卡片12px，背景 `oklch(0.977 0.013 236.62)`、文字 `oklch(0.5 0.134 242.749)`；深色下色值不变。390px 无横向溢出，临时根类及视口已恢复，控制台无 warning/error，正文与更新前一致。
- 自动化及构建通过，完整 `pnpm verify` 仍在既有 CSS 门禁失败（89,134 / 87,040 字节）。构建安装成功，运行中服务仍只有 PID50577，未重启或新增副本。
- 仅颜色变化，没有重复真实输入、磁盘逐字节、原生 IME、触摸、拖拽取消或跨段落测试。安装前备份 `/tmp/memocard-tag-sky-backup.noqVkO/`；截图 `memocard-tag-fixed-sky.png`、`memocard-tag-fixed-sky-cards.png`。

## 标签单行高度统一 · 2026-10-09

- 正文胶囊使用 inline-block、20px 行高、零上下 padding；卡片与筛选 Badge 使用 h-5 / py-0。字体及固定天蓝配色保持不变，超长正文标签可按20px行高扩展，不硬裁切。
- 真实服务 service-acceptance-vault-2 的正文、卡片、筛选标签均实测20px，正文14px、卡片12px。深色尺寸不变，390px页面无横向溢出，临时根类与视口已恢复，控制台无 warning/error。
- 隔离 Vite gallery 模拟页验证编辑、删除、撤销；长标签在390px视口按20px行高换为8行，宽310px、高160px，无横向溢出。模拟页不等同真实库写回验收。
- 用户原页正在编辑，未强制刷新或修改正文；后台新开真实服务页的已保存内容与原页一致，验收后关闭临时页。原页输入完成后刷新即可加载新样式。
- `pnpm verify` 类型检查、lint、UI362项、MCP16项、Swift35项、TCP8项、Web9项及构建通过，既有 CSS 体积门禁仍失败（89,109 / 87,040 字节）。服务构建、安装、签名验证成功，没有重启服务。
- 此轮未重新验证真实库输入写回、磁盘逐字节、原生中文IME、触摸、拖拽取消、跨段落选择。备份 `/tmp/memocard-tag-height-backup.B2zsaN/`；截图 `memocard-tag-height-20.png`。

## 标签整体换行 · 2026-10-09

- 正文标签显式使用 `width: max-content` 配合既有 inline-block / max-width:100%，在行尾按完整标签宽度排版；只有超过整段正文宽度的标签才内部换行。保留14px字、20px单行高度及固定天蓝配色，不修改标签数据与编辑器节点模型。
- 当前新版服务在修改前已能完整换行，用户截图展示旧 inline 样式；此轮补充明确的固有宽度约束。更新后真实库 `#写回验收` 完整位于第二行，宽77.05px、高20px，相对段落顶偏移29.09px；刷新前后正文一致，深色高度相同、控制台无 warning/error。
- 隔离 gallery 模拟页验证行尾完整换行、行内标签、超长标签、删除与撤销，撤销后内容精确还原。390px实际视口下scrollWidth390，短标签20px，超长标签在310px正文内换为8行、高160px。真实服务临时390px设置后即时读到的视口仍1193px，不能据此宣称此轮真实库窄屏已验证；临时视口与根类均已恢复、测试页已关闭。
- `pnpm verify` 类型检查、lint、UI362项、MCP16项、Swift35项、TCP8项、Web9项及构建通过，既有初始CSS体积门禁仍失败（89,109 / 87,040字节）；本轮修改的是编辑器懒加载CSS，初始CSS大小不变。服务构建、安装与签名检查通过，未重启或新增服务实例。
- 未重复真实库输入写回、磁盘逐字节、原生中文IME、触摸、拖拽取消与跨段落选择。备份 `/tmp/memocard-tag-wrap-backup.FV93Uu/`；真实库截图 `memocard-tag-whole-wrap.png`。

## 标签输入时段落行高稳定 · 2026-10-09

- 移除纯标签段落的 rich-tag-line 节点装饰与 .875em 字号覆盖，避免文本含空格/普通文字时切换段落排版。正文继续服从阅读样式，标签保持固定天蓝、14px字、20px单行胶囊，不修改 Markdown 数据。
- 回归测试先失败后通过：纯标签、添加普通文字、撤销后均不添加段落特殊类，标签装饰与 Markdown 保留。完整 UI362项及MCP16项、Swift35项、TCP8项、Web9项、类型检查、lint及构建通过；完整 pnpm verify 仍在既有初始CSS体积门禁失败（89,109 / 87,040字节）。
- 隔离模拟页对比 #测试wwww、#testwwww、#测试w w w w、#测试中文：第一段与第二段行高均25.6px、段高25.59px，第一段标签y216.5、第二段标签y258.09不变；删除与撤销恢复完全一致。此验证是可重现文本状态切换，不是原生中文候选确认/取消验收。
- 真实 service-acceptance-vault-2 在刷新前经独立页确认已保存内容与当前页相同，随后刷新用户当前笔记；内容原样保留。正文与标签段落均25.6px，标签14px/20px。真实390px视口scrollWidth390，深色行高与胶囊尺寸相同、控制台无 warning/error，根类与视口已恢复、临时测试页已关闭。
- 服务构建、安装和签名校验通过，未重启或新增实例。备份 `/tmp/memocard-tag-leading-backup.8IghSV/`；当前笔记截图 `memocard-tag-stable-leading.png`。原生中文IME、触摸、拖拽取消、跨段落选择、真实库输入写回与磁盘逐字节未重复验证。

## 单六点入口（方案 B） · 2026-10-09

- 移除独立加号，保留六点拖动、点击菜单、键盘 ArrowDown、Shift 扩选和既有 IME 保护；插入通过 `/` 或菜单「在下方插入」。单按钮向正文收近，桌面24×24px，与正文间距8px，不改页面内容宽度或标签样式。
- 新回归先失败（两个按钮），实现后编辑器相关97项通过。默认并发 pnpm verify 两次在侧栏/外观设置等异步用例失败或超时；未修改这些无关用例，降低并发后 `vitest run --maxWorkers=2` 全部363项通过。类型检查、lint、MCP16项、Swift35项、TCP8项、Web9项和构建通过；CSS门禁仍失败，89,028 / 87,040字节，不能宣称完整 verify 通过。
- 隔离 gallery 模拟页验证六点键盘打开菜单、插入待办、撤销、斜杠筛选及取消。真实服务只读确认单入口、菜单插入选项、正文间距8px与控制台无 warning/error；未对真实库执行内容写入。窄屏设置后实际仍返回1280px，不把本轮视为390px验收，视口已恢复。
- 已构建安装到本机服务，原进程未重启。用户原页的空段落与已保存版本不同，未强制刷新或修改；另开新版真实库预览保留供查看。备份 `/tmp/memocard-single-handle-backup.jcyiCe/`；截图 `memocard-single-handle-menu.png`。原生中文IME、触摸、长拖动/拖拽取消和跨段落选择未重新实测。

## 六点入口默认灰色弱化 · 2026-10-09

- 仅新增浅色模式六点可拖动按钮的局部颜色规则：默认 #8A8A8A，不调整全局 muted-foreground、图标大小、布局或交互。悬停/展开保留原 foreground 强调色，深色继续使用既有 muted-foreground。
- 真实 service-acceptance-vault-2 独立只读页实测默认 rgb(138,138,138)、透明背景；展开为 oklch(0.145 0 none)，深色默认 oklch(0.708 0 0)。Tab 可聚焦按钮且保留2px实线焦点描边，按钮仍24×24px，控制台无 warning/error。临时深色根类恢复后关闭验收页，未刷新用户编辑中的页面或改动笔记内容。
- pnpm verify 的类型检查、lint、UI363项、MCP16项、Swift35项、TCP8项、Web9项及构建通过；仍在初始CSS体积门禁失败（89,106 / 87,040字节）。服务构建、安装及签名校验通过，原进程50577未重启。备份 `/tmp/memocard-handle-gray-backup.OShNLz/`；截图 `memocard-handle-muted-gray.png`。
- 本轮仅颜色调整，窄屏、真实库输入写回、磁盘逐字节、原生中文IME、触摸、拖拽取消与跨段落选择未重复验证。

## 六点默认灰色再调淡 · 2026-10-09

- 用户要求再弱一点，将上一档浅色局部默认色 #8A8A8A 调为 #949494。真实服务实测 rgb(148,148,148)，透明背景；菜单展开仍为 oklch(0.145 0 none)，Tab 焦点仍为2px实线。临时深色交互状态使用既有 foreground（oklch(0.985 0 none)），根类已恢复；深色默认色、窄屏及原生IME/触摸/拖拽取消/跨段落选择未重复实测。临时验收页已关闭，用户笔记内容和原页编辑状态未改动，控制台无 warning/error。
- pnpm verify 的类型检查、lint、UI363项、MCP16项、Swift35项、TCP8项、Web9项及构建通过，初始CSS门禁仍失败（89,106 / 87,040字节）。服务构建安装成功，未重启服务；备份 `/tmp/memocard-handle-lighter-backup.JuXYbT/`，截图 `memocard-handle-lighter-gray.png`。本轮不重复真实库写回或磁盘逐字节验收。

## 六点图标16px、跨端点击区域24px · 2026-10-09

- 按用户要求将 GripVertical 改为16×16px；基础按钮统一24×24px，移除窄屏 min-height:32px 和内容页的32px高度覆盖。保留 #949494 默认色、4px圆角、8px正文间距及菜单/拖拽行为。图标尺寸回归断言先因18px失败，实现后通过。
- 真实 service-acceptance-vault-2 实测1193px桌面与390px窄屏均为图标16×16px、按钮24×24px，窄屏scrollWidth390、菜单可正常打开。此次通过验收页独立CDP视口覆盖获得真实390px，非先前未生效的全局视口设置。深色窄屏尺寸相同，默认色保留 oklch(0.708 0 0)。根类及视口覆盖已恢复，临时页关闭，控制台无 warning/error，未修改真实笔记或刷新用户编辑页。
- pnpm verify 的类型检查、lint、UI363项、MCP16项、Swift35项、TCP8项、Web9项与构建通过，初始CSS门禁仍失败（88,952 / 87,040字节）。本机服务构建安装及签名验证通过，未重启服务；备份 `/tmp/memocard-handle-size-backup.Y7ov6b/`，截图 `memocard-handle-16px.png`、`memocard-handle-16px-narrow.png`。
- 本轮未重复真实库输入写回、磁盘逐字节、原生中文IME、触摸、拖拽取消或跨段落选择验收。

## 透明拖拽预览 · 2026-10-09

- 当前 Rich 编辑器原先直接用选中节点生成拖拽影像，旧 `.block-drag-preview` 仅控制 legacy 编辑器。改为克隆拖动内容、移除副本的选择类，预览容器透明、无边框、无 CSS 阴影；原位置选中底色与3px目标插入线暂时保留。用户随后询问移除原位置底色，尚未确认实施；普通块选择不改。
- 新回归先失败后通过，检查副本保留正文和标签、无选择类、Escape清理及成功放置后清理；既有移动、取消、一步撤销测试通过。pnpm verify 的类型检查、lint、UI364项、MCP16项、Swift35项、TCP8项、Web9项及构建通过；仍在既有CSS体积门禁失败（88,879 / 87,040字节）。
- 隔离 gallery 模拟页通过浏览器鼠标输入启动实际拖动，DOM实测预览背景rgba(0,0,0,0)、box-shadow:none、border:0、无选中类；原位置有选择类，插入线高3px。拖动后排序、一键撤销及拖出编辑区释放取消均通过，预览和插入线清理完成。自动化 Escape 未阻止本次原生放置，不能将单元测试等同于原生 Escape 取消已验收。截图 `memocard-drag-transparent-preview.png` 只证明源位置及插入线，不包含系统拖拽影像；系统自带阴影是否完全消失仍需人工确认。
- 本机服务构建安装成功，独立只读页确认 service-acceptance-vault-2 的既有笔记与新版CSS规则、控制台无warning/error；未修改真实笔记或刷新用户编辑页。备份 `/tmp/memocard-drag-preview-backup.oGMvd7/`，临时验收页已关闭。本轮窄屏/深色、真实库写回、原生IME、触摸及跨段落选择未重复验收。

## 仅拖拽期间隐藏源位置底色 · 2026-10-09

- 用户确认后增加 data-dragging 状态，只在有效拖拽期间将源位置选择背景设为透明，stopDrag统一清理状态；普通块选择/多选仍使用原规则，目标插入线与透明预览保持不变。baseline-ui约束本轮不增加动画、不改变布局及点击区域。
- 回归测试先因缺少拖拽标记失败，实现后UI364项通过；类型检查、lint、MCP16项、Swift35项、TCP8项、Web9项与构建通过。完整pnpm verify仍在既有初始CSS门禁失败（88,879 / 87,040字节）；新增规则在懒加载编辑器CSS，不改变该初始包数值。
- gallery隔离模拟页桌面实测源位置背景rgba(0,0,0,0)、插入线3px，拖出编辑区释放后状态与预览清理、内容顺序不变；普通选择底色仍为rgb(226,237,251)。390px深色实测scrollWidth390，拖拽背景透明、取消后恢复rgb(35,61,87)，临时根类与视口已恢复。截图 `memocard-drag-source-transparent.png` 展示无源底色及保留插入线，不证明系统拖拽影像阴影。
- 本机服务构建安装与签名校验通过，原进程50577未重启；独立只读页确认既有真实笔记和新版data-dragging规则，控制台无warning/error。备份 `/tmp/memocard-drag-source-backup.EYC0ik/`。未刷新用户编辑页或改真实内容；临时Vite服务已停止。Vite终端在视口切换期间记录ResizeObserver通知警告，未修改相关无关逻辑。原生Escape取消、IME、触摸、跨段落选择与真实库写回本轮未重复验收。

## 拖拽源位置40%不透明度 · 2026-10-09

- 仅在既有data-dragging选择规则增加opacity:.4；原位置透明底色，拖拽副本保持opacity:1，普通选择规则、按钮布局和拖拽机制不变。baseline-ui约束本轮不增加动画。
- 隔离gallery页桌面及390px深色实际鼠标拖拽确认源位置opacity:.4、预览容器及内容opacity:1、无背景与CSS阴影、插入线3px；拖出编辑区释放取消后状态和预览清理，所有正文块恢复opacity:1，普通选择底色保留。390px时scrollWidth为390，临时视口和根类已恢复。截图 `memocard-drag-source-opacity.png` 展示源位置弱化，不证明系统拖拽影像阴影已移除。
- pnpm verify的类型检查、lint、UI364项、MCP16项、Swift35项、TCP8项、Web9项及构建通过；仍因既有初始CSS预算失败（88,879 / 87,040字节）。日志 `/tmp/memocard-drag-opacity-verify.log`。临时Vite已停止，视口切换期间终端出现ResizeObserver通知，浏览器最终warning/error日志为空。原生Escape取消、IME、触摸、跨段落选择与真实库写回本轮未重复验收。
- 本机服务构建、安装、签名校验通过，原进程50577未重启；独立只读服务页确认新版opacity:.4规则、正常正文opacity:1与既有笔记内容，控制台无warning/error，临时页已关闭。未刷新用户编辑页或修改真实笔记。备份 `/tmp/memocard-drag-opacity-backup.1IXXXt/`；构建与安装日志 `/tmp/memocard-drag-opacity-service.log`、`/tmp/memocard-drag-opacity-install.log`。

## 拖拽源位置20%不透明度 · 2026-10-09

- 按用户进一步弱化的意图，将同一规则的opacity从.4调为.2，即20%不透明度（80%透明），不改变拖拽逻辑。baseline-ui约束本轮不增加动画或布局改动。
- gallery隔离页实际鼠标拖拽确认源位置opacity:.2、背景透明，预览容器与副本opacity:1、box-shadow:none；拖出编辑区释放取消后所有正文块恢复opacity:1，拖拽状态与预览均清理。截图 `memocard-drag-source-opacity20.png` 仅证明源位置效果，不包含系统拖拽影像。本轮未重复窄屏、深色、原生Escape、IME、触摸、跨段落选择或真实库写回验收。
- pnpm verify首次UI362通过、2失败；复跑UI363通过、1失败，剩余失败为App.sidebar.test.tsx的目录选择器取消用例，不在本轮CSS修改范围，未修改该逻辑。日志 `/tmp/memocard-drag-opacity20-verify.log`、`/tmp/memocard-drag-opacity20-verify-retry.log`；不宣称全套验证通过。
- 本机服务构建、安装与签名校验通过，进程50577未重启；独立只读服务页确认opacity:.2规则、正常正文opacity:1、既有笔记内容与无warning/error。未修改真实笔记、未刷新用户编辑页；临时浏览器页和Vite已关闭。备份 `/tmp/memocard-drag-opacity20-backup.bb5NTN/`，日志 `/tmp/memocard-drag-opacity20-service.log`、`/tmp/memocard-drag-opacity20-install.log`。

## GitHub发布前复核 · 2026-10-09

- 审查本轮累计源码、测试和兼容性文档；研究笔记与截图不提交。目录选择器取消用例单跑2项通过，全套UI复跑364项通过，未改测试或宣称已确定不稳定原因。
- 将块操作共享CSS从初始样式表移至block-controls.css，由Rich和legacy编辑器分别导入，保持现有样式；初始CSS由88,879降至86,299字节，低于87,040预算，不提高门禁。React性能指引支持按功能加载。
- pnpm audit --prod无已知漏洞，pnpm verify:release退出0：UI364、MCP16、原生35、TCP8、Web9、服务7项通过，macOS、iOS和本机服务构建及签名通过。日志 `/tmp/memocard-release-verify.log`、`/tmp/memocard-release-audit.log`。
- 隔离gallery页桌面正文720px、手柄24×24，块菜单及插入菜单背景/边框正常；390px正文310px、手柄24×24、scrollWidth390，菜单可见。截图 `memocard-release-editor-narrow.png`；临时视口恢复、页和Vite关闭。Vite记录ResizeObserver通知，最终浏览器warning/error为空。真实库写回、深色、原生IME、触摸、原生Escape及跨段落选择本轮未重复验收，未修改用户笔记或刷新用户编辑页。
- 提交fabb88e经GitHub release检查成功、PR状态CLEAN后，使用match-head-commit锁定合并PR #20，合并提交4a45ae998b820b82c84618b5feef4669d3d7c5c2。本地main、origin/main和远端refs/heads/main完全一致（0/0），无已跟踪改动。原有53个未跟踪研究/验收文件均保留，另新增本轮窄屏截图；未提交这些资料。PR检查运行37936855568成功；合并后main检查37937769286已触发，交接时排队中，不宣称其已通过。
