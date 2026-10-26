# 记忆卡 · MemoCard 完整开发计划

更新：2026-09-28。状态：M0 工程已落地，M1 Mac 实测与自动化检查通过部分条件；实体 iPhone 不可用，真机同步关卡未通过，完整 M2–M5 尚未启动。详见 docs/IMPLEMENTATION_STATUS.md。

UI 维护补充（2026-10-25）：当前只有 Luma / Base UI 一套视图和 Storybook，唯一生产入口为 `apps/ui/src/main.tsx`，共用 `apps/ui/dist`；默认浅色 / 黑白强调色 / Neutral / Noto Sans / 8px。现行规范见 [design/README.md](design/README.md)，迁移证据见 [UI 清理记录](design/ui-retirement-2026-10-25.md)。下文按日期保留的早期 UI 授权只说明演进，不覆盖本条当前规则，也不改变 M0/M1 真机关卡和后续业务里程碑。

本文件整体替换原 Web/PWA + 服务端 SQLite 方案，是唯一执行依据。实现进度与证据记录在 docs/IMPLEMENTATION_STATUS.md；未验收能力不能标为已交付。

2026-09-28 历史授权：支持本机 Web 查看、新建、编辑笔记及图片，复用当前 React 界面和 Swift 文件核心。最初由 Mac 应用提供 loopback 服务；该宿主方式已被 2026-09-29 的统一菜单栏服务授权取代。文件存储和只读 MCP 边界不变，当前实现见 docs/LOCAL_WEB.md。

2026-09-28 后续授权（优先于上述 Web 边界）：实现独立浏览器客户端，桌面 Chrome / Edge 经 File System Access API 直接授权本机文件夹，创建、打开、切换 MemoCard 笔记库并读写 Markdown 和图片，不要求 Mac App 运行。继续共用 React 界面、文件格式和操作契约；目录句柄和草稿存于浏览器 IndexedDB，正文仍以文件为准。换电脑需先将笔记库同步到当地磁盘并单独授权。原有本机 Web 能力继续保留，但宿主已在 2026-09-29 统一为菜单栏服务。范围不包含公开部署、账户云同步、Service Worker 离线安装、浏览器 MCP 后台服务或不支持该 API 的浏览器兼容层。

浏览器实现必须验证：空目录建库、原库重开、换库与取消、草稿恢复与隔离、带图保存、外部编辑哈希冲突、外部重命名与删除、不完整扫描、权限失效、分页和跨语言格式。浏览器无法使用 Apple 文件协调或读取 iCloud 系统冲突版本；保存使用暂存写流并在提交前再次核对内容指纹，不能宣称与外部应用之间有原子比较替换保证。此扩展不代表原 M2–M5 或真机同步关卡完成。

2026-09-28 UI 改版授权：采用 shadcn/ui sidebar-10 的紧凑导航布局，以 Base UI 组件适配；左上角管理笔记库，侧栏提供新建、搜索、所有笔记、草稿和可折叠标签，底部提供设置，连接状态收纳到库菜单、异常时额外提示。桌面侧栏可收起，手机使用抽屉。主区域接入现有列表、编辑器、设置及错误状态；不增加尚未实现的收藏、AI、回收站等入口。保留 light/blue/neutral/Geist/10px 默认选项及设备级外观偏好，底色改为白色内容区和浅灰侧栏，侧栏选中保持中性色，强调色用于操作和表单焦点。保存、草稿保护、切库隔离、桥接与文件契约继续复用；验收覆盖导航、搜索聚焦、目录操作、编辑保存、移动抽屉和主题切换。

2026-09-28 模板细节对齐：以 new-york-v4/sidebar-10 的实际源码与页面为准，统一 256px 桌面侧栏、32px 导航行、56px 无底边框顶栏、20px 库图标、768px 内容宽度与中性色导航。手机抽屉 288px，保留 44px 触控区和安全区域。设置页是现有功能的视觉延伸，采用扁平分组及紧凑下拉选择；模板没有提供设置页，不声称此部分为原版页面复刻。主题选项与业务回调保持不变。

2026-09-29 用户授权：以两个应用共用同一份笔记为目标，实现 Obsidian 文件兼容，不进行导入转换。新增 formatVersion 2 普通文件库，取消强制 notes/assets 位置和笔记 frontmatter 字段；原始正文/属性为事实来源，本机身份映射独立保存。支持基础笔记内链、Wikilink 图片、正文标签和源文件冲突检查。保留 formatVersion 1 旧库，不自动迁移。此授权优先于原计划有关笔记 UUID、日期、固定目录的约束；不代表 M2–M5 或 iPhone 同步关卡完成。具体边界见 docs/OBSIDIAN_COMPATIBILITY.md。

2026-09-29 用户追加授权：新增沙盒化的 macOS 菜单栏服务与轻量 `memocard serve` 启动器，目标覆盖 Safari、Codex、Chrome 和 Edge 的经过鉴权 loopback Web。服务通过系统目录选择器和 security-scoped bookmark 直接读写用户授权的原文件夹；切库保持同一 listener，成功提交时轮换浏览器 session，取消或候选验证失败不替换当前库。Chrome / Edge File System Access 直连继续作为可选零安装模式。Edge 仅在真实浏览器验收完成后标记为已支持。范围不包含账户、云端数据库、LAN 服务、公开分发、自动更新或浏览器间草稿同步。具体边界见 docs/LOCAL_SERVICE.md。

2026-09-29 用户追加授权：菜单栏服务支持注册多个已授权笔记库，并在侧栏和菜单栏中提供 Obsidian 式 Vault 切换。单次只激活一个 Vault；每个 Vault 独立保存 security-scoped bookmark，切换继续轮换 session 与 generation，不合并索引、草稿或文件目录。现有单 bookmark 自动迁移到注册表。

2026-09-29 用户追加授权：浏览器访问统一由 `MemoCardService.app` 提供。Mac App 不再创建第二个 loopback listener；设置页“在浏览器中打开”及兼容 URL `memocard://web` 只负责把 `memocard-service://open-web` 交给已安装的菜单栏服务。浏览器统一使用服务维护的多 Vault 列表、会话和端口生命周期；Mac App 原生界面、目录 bookmark 与只读 MCP 保持独立，本轮不增加 App Group 或跨进程状态同步。

## 1. 目标、范围与默认选择

交付个人使用的 Mac + iPhone 笔记应用：Markdown 文件保存在用户选择的 iCloud Drive 文件夹，支持外部编辑、离线记录、搜索统计，并通过只读 MCP 供 Becoming 项目内脚本读取。

| 项目 | 首版决定 |
| --- | --- |
| 使用范围 | 单人、单个笔记库；每台设备分别授权同一个目录 |
| 客户端 | Mac、iPhone、独立桌面 Web（Chrome / Edge）及菜单栏服务本机 Web；PWA 离线安装、Android 后置 |
| 内容 | Markdown 正文、图片、标签；不强制标题 |
| 存储 | Markdown 与附件为主数据；SQLite 仅做本机可重建索引 |
| 同步 | 系统 iCloud Drive；应用处理文件访问、状态、冲突与恢复 |
| 外部编辑 | 支持其他编辑器修改、重命名和新增 Markdown 文件 |
| Becoming | 项目内读取脚本；首版不增加页面或 AI 复盘入口 |
| 视觉 | Sidebar-10 页面骨架，Luma / Base UI；默认浅色 / 黑白强调色 / Neutral / Noto Sans / 8px，保留设备级外观和兼容偏好 |
| 安装 | 本机编译 Mac 应用；iPhone 通过免费 Xcode 账号验证 |
| 后续功能 | AI 洞察、分享扩展、快捷记录、语音、公开分发另行规划 |

完成标准：iPhone 创建带图片的笔记 → Mac 收到并可编辑 → 外部编辑后应用识别 → Becoming 经 MCP 搜索、读取并打开原文 → 导出后能恢复到新目录。

免费账号安装配置通常 7 天到期，需重新编译安装；交付包含重新签名说明，不承诺免维护安装。来源：https://developer.apple.com/help/account/basics/about-your-developer-account

## 2. 工程、客户端与界面

源码 `/Users/divikwu/diw/workspace/memocard`：

| 模块 | 职责 |
| --- | --- |
| apps/ui | 两端共享 React 界面 |
| apps/apple | Xcode 工程，Mac/iPhone 两个目标 |
| packages/native-core | 共享 Swift 文件访问、解析、索引、备份 |
| packages/contracts | 接口、JSON 示例、跨语言契约测试 |
| apps/mcp | Node MCP 协议适配 |
| tests/fixtures | 合成笔记、附件、错误格式、冲突数据 |

- React、TypeScript、Vite、Tailwind、Luma/Base UI、Hugeicons 和 Recharts 按需引入；编辑使用 Tiptap / ProseMirror 共享内核，阅读使用安全 react-markdown 管线；原生侧栏沿用既有 Lucide 资源，Swift YAML 使用 Yams。SQLite 仍按下文里程碑规划，不将界面迁移视为数据库交付。
- 开发环境 Node 24.18.0、pnpm 10.34.1、Xcode 27.0；独立锁文件，不升级 Becoming 依赖。最低 macOS 14、iOS 17，M1 核对实际设备。
- 运行数据、授权、令牌、构建产物不提交 Git。
- SwiftUI + WKWebView + 共享 React 页面；本机 Web 只由菜单栏服务加载同一份打包页面，经独立的鉴权 HTTP 接口调用 Swift 核心。Mac App 的浏览器入口委托菜单栏服务，不创建 HTTP listener。独立 Web 使用浏览器文件适配器直接读写已授权目录；原生与本机 Web 仍经过 Swift 核心，Node、Becoming 不直接写笔记。
- Vite 相对资源路径；HTML/JS/CSS/字体/图标随应用打包，本地 scheme + hash 路由。停 Vite、断网后也可运行。
- 桥接请求 version/requestId/operation/params；响应成功 data 或 code/message/retryable 错误。写入带 baseHash；新草稿固定 UUID，重试沿用 ID。
- 原生 notesChanged/statusChanged 通知前端，前台恢复再次核对。文件与索引不阻塞主线程；结构化传参，不拼接正文为 JS。
- UI 可选库、CRUD、附件、删除恢复、统计、冲突和备份；MCP 只有只读子集。
- 原生桥只接受应用自身主页面。Markdown 不执行 HTML/脚本；附件只在授权库内，拒绝越界与 symlink。外链交系统浏览器。

页面：全部笔记、标签与搜索、统计、回收站、设置；有异常才展示待处理入口。Mac 侧栏，iPhone 单列与独立编辑页。输入保存本机草稿，按钮或 Mac ⌘Enter 提交，文件成功后清草稿。当前编辑器以 Tiptap / ProseMirror 语义 DOM 在同一编辑区呈现标题、强调、列表、表格、公式和本地图片；保存通过共享 Markdown 解析/序列化和版本保护处理，未支持语法保留原格式。早期“光标段落显示源码标记”的 CodeMirror 体验属于历史要求，已由现行编辑器替代；不据此承诺任意 Markdown 扩展无损结构化编辑。系统图片选择器导入相对引用。创建时间倒序，编辑不移动位置。

设置：笔记库、同步状态、重建索引、备份恢复、外观；Mac 另有 MCP 开关/配置导出。业务入口按实际已实现能力展示，未交付的计划不因 UI 迁移视为完成。现行外观支持浅色/深色/系统、8 种强调色、2 种中性色、标题/正文字体和常规 0/7.2/8/10/14px 圆角；默认采用 Luma 浅色/黑白/Neutral/Noto Sans/8px。旧合法字体与圆角兼容恢复，当前选项与字体资源以设置页及源码白名单为准。正文内容风格独立；首版无自由 HEX、背景图和逐组件改色。

界面保留 Sidebar-10 页面骨架，使用 shadcn Luma / Base UI 与 Tailwind CSS 4；现行控件、业务视图和页面在 `apps/ui/ui-next`，共享控制器与文件/宿主桥接在 `apps/ui/src`。Web、H5、macOS/iOS WebView 和本机服务消费同一生产构建；Storybook 和状态预览使用隔离数据。这不将 M1 真机关卡或完整 M3 标记为通过。

## 3. 文件契约、同步与可靠性

```
MemoCard/
  .memocard/vault.json
  notes/<UUID>.md
  assets/<UUID>.<扩展名>
  conflicts/                    # 需要时创建
```

vault.json：formatVersion=1、稳定 vaultId；没有全局清单和多端共写计数器。首次 Mac 或受支持的独立 Web 在空目录中显式创建，iPhone 选择已同步的库；不能因元文件待下载就创建第二个 ID。未来格式停止写入并提示。

```markdown
---
id: "稳定 UUID"
createdAt: "2026-09-28T08:00:00Z"
updatedAt: "2026-09-28T08:00:00Z"
tags: ["工作", "想法"]
---

正文。

![图片](../assets/附件ID.jpg)
```

删除加 deletedAt，恢复移除。写入 UTC ISO8601；显示/统计默认 Asia/Shanghai，可调整。

### 外部编辑

- 合法正文/元数据修改：重读、计算 hash、更新索引。
- notes 内改名/移动：ID 不变，更新路径，附件遵守 Markdown 相对路径语义。
- 重复 ID：全部保留并待处理；确认保留两份后副本获得新 ID。
- 外部无 ID/时间：待处理，确认导入才补齐，不自动改写。
- YAML 或字段损坏：保留源文件、允许查看、暂停覆盖保存。
- 未知字段和值保留，只修改自有字段。
- 外部改正文没改 updatedAt：通过 hash 检测，不伪造时间。时间不决定冲突胜负。
- 移出受管范围/物理删除：确认后移除索引，不从缓存/旧草稿自动复活。

### 保存与同步

系统目录选择器授权，bookmark 恢复；授权失效要求重选并保留草稿。文件协调使用 Apple 文档 API。

1. 本机持久保存草稿及固定 ID。
2. 唯一名称的新附件完整落盘。
3. 协调读写内重读源文件并验证 baseHash。
4. 临时文件+原子替换提交正文。
5. 更新索引并通知 UI。

冲突保留草稿，不覆盖源文件。附件成功/正文失败可留下孤立附件，首版不自动清理。正文成功/索引失败报告已存本机且索引待修复，不重复创建。

状态区分：已存本机、等待上传/下载、同步异常、授权不可用、状态未知。本机成功不代表其他设备收到。离线可新建和编辑已下载笔记；占位文件不当成空白/损坏/删除。

系统冲突：展示当前与冲突版本；用户选择后，先保存核验恢复副本，再更新主文件，最后标记系统冲突已解决。应用删除为可恢复标记，不永久清空。外部删除遇到草稿只允许显式另存。

### 索引、搜索、统计

- SQLite 仅存在各设备数据目录；文件唯一事实来源。
- 变更增量更新；启动/前台/手动刷新完整核对。
- 扫描失败、待下载、失去权限不得批量删索引。
- 初始未完成时返回覆盖状态，不将已索引量当总量。
- 正文规范化子串搜索，英文不区分大小写；标签精确 AND。
- 按 createdAt 筛选，from 包含、to 不包含；默认 50、最多 100 条，游标绑定查询和索引版本，变化后重翻页。
- 统计有效总量、活跃天数、日/周/月创建趋势、标签分布；删除/待导入/冲突单列。多标签可重复计入分类，并解释口径。

### 备份恢复

- 导出带校验清单的完整目录，含 vault/正文/附件/冲突；排除索引、草稿、凭据、临时文件，目标位于活动库外。
- 核对清单、hash、附件引用；源文件变化重新核对，不产出混合快照成功标记。
- 待下载/不可读/缺失必须报告，不标完整成功。
- 仅恢复到空目录，校验后重建；保留笔记 ID/vaultId、重新授权，不自动合并原库。
- 必须验收真实恢复，不以导出存在代替。

## 4. MCP 与 Becoming

Mac 启用 App Sandbox。用户启用 MCP 后 NWListener 只绑定 127.0.0.1 系统分配端口，随机 token 的 TCP 只读接口。退出/禁用关闭 listener 和全部连接。无 App Groups、无公开 HTTP、无后台 helper。

- 用户选择库及 Git 仓库之外的配置目录并保存授权。
- listener ready 后原子写 0600 connection.json：version/host/port/token/instanceId/vaultId。
- 启动/重新启用轮换 token；Node 每次连接重读配置。发布失败不标就绪，失效明确报错。
- 内部 NDJSON 正确缓冲分段 UTF8/多消息，限制长度和超时，先鉴权后返回数据；日志无 token 和正文。
- 官方 TypeScript MCP SDK，锁版本。stdout 只有协议，日志 stderr。

| 工具 | 行为 |
| --- | --- |
| get_status | 库 ID、覆盖、待处理量、运行状态 |
| search_notes | 关键词、标签、时间、分页、摘要与来源 |
| get_note | ID 对应的协调读取正文 |
| list_tags | 有效笔记的标签与数量 |

返回 hash、笔记时间、索引时间、覆盖、来源；待下载/冲突/删除/无权限分别报告。错误码覆盖参数、应用未运行、未授权、库不可用、待下载、冲突、索引不全、过期游标、超时、未找到。

原文 memocard://note/<id>?vault=<vaultId> 只定位、不写入、不接受任意文件路径。

Becoming 独立读取脚本，不修改图片配文：本机配置指定 Node/MCP 产物/连接文件绝对路径；官方 client 启动 adapter，查询状态并 search/get，输出正文/摘要/来源/时间/hash/完整性 JSON；退出只关自建 adapter，不关 App。命令 pnpm memocard:read，status/search/get 子命令；配置不提交 Git。必须真实脚本验收，Inspector/Codex 单独成功不算 Becoming 已接入。不自动写长期数据。

## 5. 实施阶段与关卡

独立测试库，不自动导入真实笔记。前置关卡失败暂停依赖阶段，记录并修正；不擅自换存储、购买会员或扩大范围。

| 阶段 | 交付 | 通过标准 |
| --- | --- | --- |
| M0 | 统一计划/工程/契约/依赖/签名配置 | 可安装、构建，旧架构不再实施 |
| M1 | 最小两端、目录授权、带图读写、打包页面、本机连接 | 免费签名真机运行，同库同步；停 Vite 完整；Sandbox Node 连通 |
| M2 | 解析、草稿、原子保存、冲突、删除恢复、索引、备份 | 崩溃无半文件、外部编辑不覆盖、恢复成功 |
| M3 | 完整记录/搜索/统计/主题/待处理 | 两端日常可用，搜索统计一致，重启恢复 |
| M4 | 正式 MCP、Becoming 脚本、原文跳转 | 项目真实读取，退出/重启/撤销行为正确 |
| M5 | 安装包、源码、验证、安装/签名/恢复/故障文档 | 关键验收通过，未通过明确列出，不用模拟替代真机 |

M0—M5 为授权范围；AI 洞察另立后续阶段：近期复盘、主题洞察、观点反思。本轮不选模型、上传笔记或添加假洞察入口。

## 6. 测试与交付

前端 lint/TS/build/交互；Swift 解析/保存/索引/恢复；同一组合成 fixture 跨 Swift/React/MCP 验证字段、排序、错误、覆盖；Node 实际 stdio 启动和生命周期；破坏测试独立目录。

| 类型 | 必测 |
| --- | --- |
| 真机 | 手机文字+图→Mac 编辑→手机更新 |
| 外部编辑 | 修改/改名/移动/无元数据/重复ID/损坏YAML/物理删除 |
| 冲突 | 两端离线改同篇，联网后双方可恢复 |
| 崩溃 | 附件中/正文提交前后终止，保留旧或完整新正文 |
| 可用性 | 待下载/失败/撤权/扫描中断不误删 |
| 索引 | 重建一致，中文/日期边界/标签/回收站 |
| 备份 | 空目录恢复正文标签时间图与冲突完整 |
| 安装包 | 停 dev+断网后 JS/CSS/字体/图标/图片/弹层/图表 |
| 手机 | 中文输入、键盘、图片、后台与重启草稿 |
| TCP | 仅loopback、错token无内容、重启新配置、退出无残留 |
| Becoming | 脚本 search→get→原文，和 App 一致 |
| 边界 | HTML不执行、越界/symlink/未经授权桥接拒绝 |

最终交付记录设备、OS、构建号、限制；Mac 和 iPhone 安装有可见证据；安装包无 Vite/云服务器依赖；交源码、锁文件、构建命令、测试结果、MCP 和恢复说明；免费签名同 bundleID 重装与重授权说明。本次不公开发布、不创建付费资源、不迁移真实笔记。

页面打开、mock 数据和单工具成功不能代表整体完成。

### 2026-09-28：原模板重建执行结果

以官方 registry 源码快照重新构建 SidebarProvider、Sidebar、菜单、工具栏和基础控件，替代逐项补丁式对齐。保留 Base UI、现有文件适配器、草稿和保存逻辑。模板来源及适配边界见 `docs/ui-reference/README.md`；验收记录见 `docs/IMPLEMENTATION_STATUS.md` 的最新章节。此次完成 UI 重建，不改变 M1 真机验证及其他未完成里程碑的状态。

### 2026-09-28：目录浏览增量

按用户授权支持真实 notes 多级目录树、折叠展开、空目录展示及包含后代的目录筛选；保留独立标签分类。目录修改操作与在所选目录新建笔记另行实施，此次不改变已有文件路径。


## 2026-09-28 UI 审查整改

以 `docs/UI_REVIEW_2026-09-28.md` 的 10 项发现为本轮范围，已完成记录界面、空状态、草稿与阅读全文、模式提示和移动触控统一。当前目录新建笔记以所选 notes 子目录作为保存位置；relativePath 同时用于草稿、正式保存和新增图片引用。已有笔记继续按稳定 ID 找到当前真实路径；目标目录不存在时保留草稿并报错，不回退根目录。标签入口统一使用全库范围。详细验证与真机未覆盖边界见审查文档。
