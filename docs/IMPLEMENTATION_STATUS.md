# 实施与验收记录

日期：2026-09-28。构建：0.1.0 (1)，Debug，源码位于 `/Users/divikwu/diw/workspace/memocard`。

**当前交付为 M0/M1 平台验证版，完整 M0–M5 计划未完成。** 用户计划要求“前置关卡失败时暂停依赖它的阶段”。物理 iPhone 关卡尚未通过，因此没有宣称真机安装、免费签名或双端 iCloud 同步成功。随后用户明确授权先重设计现有 UI 并沿用 Becoming 主题；该部分已经落地，其他依赖真机关卡的数据功能仍未启动。

## 阶段状态

| 阶段 | 当前状态 | 剩余通过条件 |
| --- | --- | --- |
| M0 工程与契约 | 已建立独立源码、锁文件、Mac/iPhone 目标、共享 JSON/Markdown 样本；可安装并构建 | iPhone 签名能力随 M1 真机实测确认 |
| M1 平台验证 | Mac 真实读写/图片/重启/深链/MCP 已验证；iOS 模拟器可构建、安装、启动 | 免费账号真机安装、手机可见界面、两端同库、iPhone→Mac→iPhone 带图同步；无开发服务器且断网验收 |
| M2 可靠数据核心 | 未开始完整阶段；M1 已有文件协调、哈希冲突拒绝覆盖和草稿基础 | SQLite、完整索引状态、离线/冲突恢复、删除恢复、备份恢复及故障注入 |
| M3 完整界面 | M1 记录/搜索/设置已重设计，设备外观设置已实现 | 统计、回收站、待处理与手机输入验收 |
| M4 MCP / Becoming | M1 的四个 MCP 工具与真实 Mac 连通已验证 | Becoming `pnpm memocard:read` 实际项目脚本及完整错误/撤权验收 |
| M5 交付 | 已提供当前源码、构建产物与开发安装说明 | 完整安装交付、真实恢复、全部关键验收和真机重新签名记录 |

Becoming 工作区本次保持 clean，未修改图片配文链路、依赖或长期数据。未接触真实个人笔记，未创建付费资源，未公开发布。

## 环境

- Mac：Apple Silicon，macOS 27.0 (26A428)，Xcode 27.0 (27A266a)。
- Node 24.18.0，pnpm 10.34.1；UI 与 MCP 各自锁定在根 pnpm-lock.yaml，Yams 5.1.3 固定在 Swift Package.resolved。
- Mac 实际构建使用本机已有 Apple Development 证书；App Sandbox、目录读写/bookmark、网络 client/server entitlement 经 codesign 核验。
- iPhone17,1 实体设备：devicectl 返回 unavailable，未安装应用；不能从已有 Mac 证书推断 iPhone 免费签名成功。
- iPhone 18 Pro 模拟器：构建/安装/启动成功。Xcode 27 的设备界面通过 Device Hub 提供；此次界面自动化读取超时，未把进程启动当作画面验证成功。
- 最低目标 macOS 14 / iOS 17 已配置；没有在这些最低版本上执行兼容性实测。

## 自动化证据

`pnpm verify` 完整成功，共 **70 项测试**：

| 检查 | 结果与边界 |
| --- | --- |
| UI TypeScript / ESLint / production build | 通过，本地 Geist 字体、相对资源、生产 CSP |
| UI Vitest | 34/34；桥接、错误、Markdown 安全、UUID fallback、深链、共享 fixture |
| MCP TypeScript / build / Node tests | 13/13；实际官方 SDK stdio + 测试 TCP 服务、配置校验、超时、分帧 |
| Swift Package | 17/17；真实临时文件、哈希冲突、原子保存、重复 ID、查询、未知 YAML、外部移动删除、图片、草稿、共享契约 |
| 原生 Network.framework | 6/6；生产 LocalReadServer.swift，真实 IPv4 TCP、UTF-8 分段、连续帧、半关闭、限长、鉴权；strict-concurrency=complete / warnings-as-errors |
| Mac Xcode build | Apple Development 签名构建成功 |
| iOS Xcode build | iOS Simulator 构建成功；不是物理设备签名验证 |
| 隔离安装 | 无 node_modules 的源代码副本中 frozen install 与 UI/MCP build 成功；364 包复用本机 pnpm 缓存、0 下载，不是无缓存网络安装验证 |

共享样本：`tests/fixtures/bridge-v1.json` 与真实 `tests/fixtures/vault`。Swift 从文件解析结果逐项比对；UI 与 MCP 使用同一 JSON。没有把内存网络测试称为真实设备同步测试。

隔离构建目录 `/private/tmp/memocard-clean-install.2a7oRu`；原、副本 lock SHA-256 相同：`e1f8a7f276509250d91393c44351aacb01a3e5255b44c4a6c569944ecd8bfdbd`。

本机详细日志（临时文件，未提交）：`/tmp/memocard-verify.log`、`/tmp/memocard-build-mac.log`、`/tmp/memocard-build-ios.log`。

## Mac 真实应用验证

2026-09-28 12:47–13:01，使用打包后的 `build/apple/Build/Products/Debug/MemoCard.app`，Vite 已关闭。界面截图和 accessibility 结果已在本次聊天中记录。

1. 原生选择器授权 `/private/tmp/memocard-m1.igJGuO/vault`，应用创建元文件与子目录。
2. 在真实 WKWebView 中输入中文、标签，通过原生选择器导入合成绿色棋盘 PNG。Markdown 预览实际显示正文与图片。
3. 点击保存后磁盘出现完整 Markdown 与独立图片；随后在修复后的构建再次保存，界面草稿数量清零。按创建时间排列不因编辑改变。
4. 在应用外追加正文、保留原 updatedAt，并重命名文件为 `external-edit.md`。应用按相同 UUID 显示新内容与图片。
5. 退出后无 MemoCard TCP 监听；重启恢复原目录授权和笔记。冷启动 `memocard://note/<id>?vault=<id>` 直接打开正确笔记。
6. 配置导出到笔记库与代码仓库之外，权限为 0600；lsof 显示仅 `127.0.0.1:<动态端口>`。
7. 错误令牌返回 UNAUTHORIZED，无笔记数据。开启偏好持久化后，重启自动恢复 MCP，token 与 instanceId 均改变，vaultId 保持一致。
8. `pnpm --filter @memocard/mcp smoke --connection-file <绝对路径>` 使用官方 SDK，实际运行编译适配器，四个工具均成功；搜索后读到同一正文/指纹，标签为 2。这是 M1 验证，不代替 Becoming 项目脚本。

生产页面使用自定义 scheme；CSP 禁止 connect、frame、object 和表单提交；Markdown 不执行原始 HTML，附件仅通过受限原生接口读取。初次 WebKit 子进程启动失败已修复为标准 network.client entitlement，保持 Sandbox 开启；修复后字体、图片和页面在打包应用中可见。

## 实际 iCloud Drive 验证

专用目录：`~/Library/Mobile Documents/com~apple~CloudDocs/MemoCard-M1-Test-20260928`。

- 通过 Mac 应用的“创建新笔记库”与系统选择器，应用实际写入 `.memocard/vault.json`，创建 notes/assets，并切换读取服务到新 vaultId。
- 随后仅向该测试库外部复制前述合成 Markdown/PNG，验证外部新增文件。官方 MCP smoke 从 Mac 原生服务读取该库成功，coverage complete / indexed 1 / pending 0 / issues 0。
- Foundation 查询显示元文件和测试 Markdown 均为 ubiquitous item，`isUploaded=true`、`isUploading=false`、下载状态 current。**这是本机系统报告的上传状态，不是另一台设备收到的证据。**
- 创建后界面自动化返回 timeoutReached。App 采样显示主线程正常等待事件，MCP 仍可响应；没有证据断言是 App 死锁，也未继续宣称 iCloud 界面读写已完整验收。
- 当前 Mac 应用选中该 iCloud 测试库；本机测试库仍保留。测试配置位于 `/private/tmp/memocard-m1.igJGuO/connection/connection.json`，令牌不进入仓库或本文。

## 已知限制与继续顺序

1. 连接并解锁实体 iPhone、信任 Mac；使用同一 Team/bundle ID 构建安装。先完成 M1 真实设备关卡，记录系统和安装结果。
2. 补齐 iPhone 可见画面与中文输入/图片选择；选择上述 iCloud 测试库，验证双向文字和图片。
3. 恢复界面自动化后完成 Mac iCloud 界面验收与实际断网打包验证。当前没有关闭用户的系统网络来模拟断网。
4. M1 核心逐次扫描文件，尚无 SQLite；不完整扫描时保留本机草稿并拒绝正式保存，尚未达到最终离线新增要求。系统冲突保留并报告，尚无解决界面。
5. 未实现统计、回收站、完整备份/恢复；外观设置已在后续 UI 改版交付。YAML 未知字段值保留，但注释与排版不保证原样；草稿仅在成功提交且仍匹配时清除。
6. 通过 M1 后按 PROJECT_PLAN.md 进入 M2 → M3 → M4 → M5。下一步不是导入真实笔记，也不是把模拟器成功当作真机通过。

当前安装说明见 INSTALLATION.md；完整备份恢复操作说明需在 M2 功能实际落地、恢复验收通过后补齐，不能以文档代替实现。

## UI 与 Becoming 主题改版（2026-09-28 13:20）

按用户后续要求改用 shadcn/ui + Base UI + Tailwind CSS，取消固定绿色。主题 tokens、字体列表、圆角与配色取自 Becoming/dashboard；实际入口默认 light/blue/neutral/Geist/lg（10px）。Becoming Git 工作区复查仍 clean。

- 实际生成并使用13个 shadcn base-maia 源码组件：Button、Input、Textarea、Dialog、Tabs、Card、Badge、Separator、Sheet、Alert、Skeleton、Select、Switch；使用 @base-ui/react 1.7.0，无 Radix。Tailwind CSS 4.3.3、shadcn CLI 4.17.0，锁文件已更新。
- 紧凑桌面侧栏、单列笔记流、手机 Sheet 导航和全屏编辑；长库名截断，保留无原生桥时的真实预览边界。未加入模拟笔记或未完成功能入口。
- 外观支持3种显示模式、8种强调色、2种中性色、27种标题/正文字体选项、7档圆角；25种字体随应用打包，设备偏好独立保存。恢复默认回到浅色/Blue/Neutral/Geist/10px。
- 新增编辑器草稿串行写入、异步关闭保护、中文输入法快捷键保护。真实 WKWebView 验证发现进入动画可能使弹层保持透明；去除 Dialog/Sheet/Select 装饰动画，保留原语的键盘/焦点交互，并沿用 Becoming 的主题切换过渡抑制。重建后弹窗与主题切换可见。

### 最新检查

`pnpm verify` 在改版后通过（当时 UI 51 项）；随后针对弹层和主题调整，UI 重新执行全部测试、lint、TypeScript 和两端构建。最终累计 **88 项通过**：UI 52、MCP 13、Swift 17、原生 Network 6。UI 新增18项交互/主题测试覆盖实际组件、草稿保存顺序、异常关闭、中文 IME、Sheet、搜索和外观恢复。

Mac Apple Development 签名构建及 iOS Simulator 构建通过。最新模拟器安装/启动成功（iPhone 18 Pro / iOS 27.0）；Device Hub 界面读取仍超时，未将其记为手机画面、输入或真机验收。Vite 对本地 JS 主包约562 KB给出500 KB阈值提示；构建无错误，全部资源包约4.4 MB，无远程字体依赖。

日志：`/tmp/memocard-ui-redesign-verify.log`、`/tmp/memocard-ui-redesign-ui-final.log`、`/tmp/memocard-ui-redesign-mac-final.log`、`/tmp/memocard-ui-redesign-ios-final.log`。先前隔离安装/lock指纹属于旧 M1 基线，不代表此次更新后的锁文件已做无缓存安装。

### Mac 实际验收

1. 打包应用显示现有 iCloud 合成测试笔记和本地附件；无预览数据替代。
2. 切换深色、Mono、Slate、8px 后退出进程并重启；各选项、原库授权和笔记均保留。字体选择器通过键盘改为 Inter；恢复默认后回到 Geist。
3. 打开新 Dialog，在合成测试笔记追加“UI 改版验证：shadcn / Base UI / Becoming 主题。”，预览正文和图片后保存。磁盘 Markdown 出现该文字，列表保持原创建时间，成功提示与草稿清除正常。
4. 关闭此任务的 Vite（127.0.0.1:5179）后，打包应用继续正常使用。没有关闭整台 Mac 的网络，不能将此项表述为已验证系统断网。
5. 实际 MCP smoke 再次通过四工具调用，读取的正文与原文指纹一致。此项仍不替代未交付的 Becoming 项目读取脚本。
6. 验证结束恢复 Becoming 默认外观。原生应用保持打开，可在“笔记库设置 → 外观”继续调整。

## 审查修复与优化（2026-09-28 13:45）

已修复功能审查中的 7 个问题，并消除真实 WKWebView 中编辑/预览内容重叠。保持 shadcn/ui + Base UI + Tailwind CSS 与 Becoming 默认主题，未扩展 M2–M5 范围。具体触发条件、修复和证据见 [审查记录](REVIEW_2026-09-28.md#优化与回归结果)。

- 编辑器保护异步会话，旧读取不能替换新草稿；标签按独立项保留原值，兼容中文输入法。
- 图片引用按笔记真实目录生成和解析；编辑过程中外部移动文件后，导入图片会同步更新预览路径。允许格式统一为 PNG/JPEG/WebP/GIF/HEIC/HEIF，TIFF 写入前拒绝。
- 搜索按 2 MiB 编码笔记数据预算分页；TCP 响应上限为 64 MiB，完整 MCP 工具结果上限为 8 MiB，超限明确返回 `RESPONSE_TOO_LARGE`。稳定错误码得到保留，日期 `to` 描述改为不包含上限。
- 最终 `pnpm verify` 全部通过：UI 74、MCP 16、Swift 23、原生 Network 8，共 **121 项**；lint、TypeScript、生产构建通过。Mac 签名构建和 iOS Simulator 构建均通过，未进行实体 iPhone 安装。
- 真实核心 → 本机 TCP → MCP → 默认官方 SDK，完整分页读取 10 条各 1 MiB 的合成笔记；超大单条明确报错后会话仍可用。
- 重建后的 Mac 应用实测子目录笔记列表/预览图片正常，预览无重叠；只改正文保存后，标签 `machine learning`、`C#,F#`、`#literal`、原 ID 和创建时间保持不变。MCP 四工具 smoke 再次通过。选择器被取消，此轮新图片导入以真实文件自动化验证为准。
- HTTP 预览正常渲染，控制台 warn/error 为空。Becoming 工作区仍 clean。

日志：`/tmp/memocard-optimize-final-verify.log`、`/tmp/memocard-optimize-mac.log`、`/tmp/memocard-optimize-ios.log`。截图：`build/verification/optimization/native-preview-fixed.png`、`native-saved-fixed.png`。

当前仍为 M0/M1 平台验证版：物理 iPhone 安装和双端同步、SQLite、统计、回收站、备份恢复及 Becoming 实际读取脚本尚未完成，不能把本轮缺陷修复当作完整计划交付。

## 编辑与预览合一（2026-09-28）

按用户圈选的“编辑 / 预览”两个标签页要求，改为 CodeMirror 6 单编辑区实时排版，保留现有 shadcn/ui + Base UI 弹窗、标签、图片按钮、草稿与保存流程。标题、强调、代码和本地图片直接显示；当前编辑行显示 Markdown 标记。没有新增独立 Web 文件读写能力。

- 原始 Markdown 是唯一编辑数据；打开、只改标签和编辑其他段落不会整体重新序列化正文，混合 CRLF/LF、参考定义、HTML 字面文本和未知扩展保留。引用式图片/链接当前保留源码，不承诺所有 Markdown 扩展都可视化渲染。
- 图片仍通过笔记真实目录解析并限制在库内，保存原相对路径；外部目录变化只更新展示上下文，不重建编辑实例。普通点击链接定位编辑，`⌘` / `Ctrl` + 单击通过原生桥打开。Markdown 字符实体只在派生 URL 时解码，恶意协议和越界路径继续拒绝。
- 新增组件 13 项回归测试；Editor/App 使用真实 CodeMirror 编辑事务验证原有异步竞态、标签、草稿序列、IME、关闭与快捷保存，共 27 项。最终本轮完整 UI 套件 **89 项通过**，TypeScript / ESLint 通过；Mac 签名构建和 iOS Simulator 构建均成功。Swift/MCP 核心本轮未改动，未重复运行其测试。
- 重启后的真实 Mac 应用已显示单编辑区。向独立合成笔记输入中文、标题、粗体、斜体和既有测试图片引用，实际截图确认排版、图片与输入光标同时存在，没有切换标签页，界面显示草稿已存本机。
- 用户同时在操作应用，后续停止 UI 操作，保留现有草稿；此次新编辑器的快捷保存人工验收未完成，不能以自动化通过替代人工记录。未读取受系统保护的 App 容器草稿文件，也未修改用户原有草稿。

证据：`build/verification/unified-editor/native-editor.png`；`/tmp/memocard-unified-ui-final.log`、`/tmp/memocard-unified-mac-final.log`、`/tmp/memocard-unified-ios-final.log`。Becoming 工作区保持 clean。iPhone 真机输入和双端同步仍待验收。

## 状态信息精简（2026-09-28）

移除原生页面顶部“本机文件”和每条笔记的“已存本机”。保存成功保留 3.5 秒“已保存”提示；编辑器草稿状态、错误提示和文件尚未就绪提示继续保留。侧栏笔记库入口统一显示连接状态，存在聚合问题或待读取文件时显示实际数量；设置中集中说明文件存储与系统同步职责。浏览器预览标识继续保留。现有数据不能证明其他设备收到文件，因此未新增“已同步”状态，也未虚构单条笔记的异常详情。

验证：UI 89 项现有测试、ESLint、TypeScript / 生产构建通过，Mac 签名构建和 iOS Simulator 构建成功。重启后的真实 Mac 列表已确认两处重复文案消失，笔记仍为 2 条、草稿仍为 3 条；本轮未修改笔记或草稿数据。截图 `build/verification/status-cleanup/native-notes.png`，日志 `/tmp/memocard-status-ui.log`、`/tmp/memocard-status-mac.log`、`/tmp/memocard-status-ios.log`。

## 本机 Web（2026-09-28 15:06）

用户追加授权后，新增依赖 Mac 应用运行的本机 Web，复用共享 React / CodeMirror / shadcn Base UI 界面与 Swift 文件核心。Mac 设置提供“在浏览器中打开”“复制访问链接”“关闭本机 Web”。Vite 5179 仍是开发预览；可用网页由应用内独立 HTTP 服务提供，监听系统分配的 IPv4 loopback 端口，不依赖 Vite 或 Node 后端。

- 单次、2 分钟启动链接换取 HttpOnly / SameSite=Strict 会话 Cookie；精确 Host/Origin 校验、无 CORS、严格操作白名单。MCP 服务和凭据独立，仍只读。日志不包含凭据或笔记正文。
- Web 支持读取、新建、编辑、标签、中文搜索、Swift 草稿、浏览器图片选择器与同源图片读取。目录授权、切换笔记库和 MCP 设置保留在原生端；断开时保留当前输入并禁用新建，不伪造空库。浏览器关闭前保护尚未成功持久化的文本，不承诺断线时浏览器崩溃恢复。
- Web 请求在 Swift actor 内再次核对库会话 binding，防止排队请求在切换到相同 vaultId 的恢复副本后写错目录。切库/停用/退出会撤销监听和授权；已提交文件仍由 iCloud Drive 系统同步。
- 实际浏览器联调发现 Vite 将 CSP 引号编码为 `&#39;`，旧字面替换没有生效；已改为仅对 HTTP 返回页面移除原生 CSP meta，由响应头应用 Web CSP，并加入生产格式回归。字体改为打包实体文件，避免 data 字体被 CSP 拦截；原生页继续禁止网络连接。

### 验证结果

1. 最终 `pnpm verify` 通过，共 **166 项**：UI 109、MCP 16、Swift 25、原生 TCP 8、本机 HTTP 8；TypeScript、ESLint、生产构建通过。Mac Apple Development 签名构建与 iOS Simulator 构建通过。
2. 真实 Sandbox Mac 应用监听 `127.0.0.1:55636`，Codex 内置浏览器完成授权并显示原 2 条合成笔记及图片，console warn/error 为空。一次性令牌已从地址栏移除。未授权附件请求返回 HTTP 401。
3. 浏览器通过真实文件选择器导入测试图片，创建“本机 Web 联调验证”，随后再次编辑。Mac 界面显示同一条笔记、图片和编辑后正文；中文搜索“再次编辑验证”返回 1 条。图片实际解码为 320×160，上传后文件字节与测试图片一致。
4. 真实文件检查确认 ID `0a419f5b-4a46-47f2-82a4-7339fac25e20`、创建时间、`Web 验证` 标签与相对图片引用保留，正文为完整 Markdown。测试库最终新增 1 条笔记、1 个附件；原有 3 条草稿保持，未导入个人笔记。
5. 实际 MCP 四工具 smoke 通过（`stdio-to-native-loopback`，3 条笔记、完整覆盖），仍未扩展到写操作，亦不替代未完成的 Becoming 实际读取脚本。
6. HTTP 自动化覆盖服务停止、重启后旧会话失效、错误 Origin/Host、重复令牌、分段 UTF-8、32 MiB 请求限制、路径和符号链接拒绝；UI 自动化覆盖断开保留输入、离开页面保护与分页轮询。用户在试用 Web 页面，未为人工断线验收停掉其正在使用的服务。

证据：`build/verification/local-web/browser-search.png`、`file-check.json`；日志 `/tmp/memocard-local-web-final-verify.log`、`/tmp/memocard-local-web-mac-final.log`、`/tmp/memocard-local-web-ios-final.log`。使用和限制见 [LOCAL_WEB.md](LOCAL_WEB.md)。端口随应用重启改变；浏览器外观偏好按 origin 保存，新端口可能恢复默认。Becoming 工作区保持 clean。

本轮新增的是本机 Web 能力，不是独立云端 Web/PWA。真实 iPhone、iCloud 双端同步及其余 M2–M5 验收仍未完成。

## 独立 Web 文件夹访问（2026-09-28 15:35）

按用户后续授权，独立 Web 已增加 File System Access API 适配器。桌面 Chrome / Edge 可在 HTTPS 或 localhost 页面中直接创建、打开和切换本机 MemoCard 笔记库，不要求 Mac 应用运行。原生端、依赖 Mac 的本机 Web 与独立 Web 共用 React 界面和文件契约；原有 Swift / MCP 读取路径保持不变。使用与平台限制见 [BROWSER_VAULT.md](BROWSER_VAULT.md)。

- Markdown 与图片仍写入授权目录；目录句柄和未提交草稿保存在当前 origin 的 IndexedDB。目录注册身份与 `vaultId` 分开，恢复副本使用相同 `vaultId` 时不会混用草稿；切库后旧编辑会话和分页游标失效。重新载入只查询权限，重新授权由用户按钮触发。
- 浏览器保存先持久化草稿，再按笔记 ID 查找实际文件，检查原始字节指纹；同源标签页通过 Web Locks 串行写入，文件使用独占暂存写流，并在提交前复核源文件。外部改动、删除、重复 ID、损坏元数据和扫描不完整均不会被静默覆盖。两个标签页恢复同一草稿时各自分叉，提交成功后只清理仍与原值匹配的草稿。
- 浏览器图片导入会校验格式并实际解码，支持 PNG、JPEG、GIF、WebP；HEIC / HEIF 导入明确要求先转换。显示图片只读取已校验的库内路径，切库或组件卸载后丢弃过期读取并回收生成的 Blob URL。
- 本轮未公开部署、未实现账户云同步或 Service Worker 离线安装。各电脑需先同步本地笔记库并分别授权。浏览器不能提供原生文件协调或 iCloud 系统冲突版本读取；最终指纹检查与写流关闭之间仍有外部写入竞争窗口，创建新文件后意外崩溃也可能留下空文件。不能以此宣称完整 M2 数据可靠性验收通过。

### 最新自动化结果

最终 `pnpm verify` 于 15:35 完整结束，退出码 0，共 **210 项测试通过、0 失败**：

| 检查 | 结果 |
| --- | --- |
| UI TypeScript / ESLint | 通过 |
| UI Vitest | 153/153；其中独立浏览器文件核心 26 项，覆盖共享 Swift fixture、外部修改、重复 ID、权限、切库、草稿并发、分页与图片校验 |
| MCP Node tests | 16/16 |
| Swift Package | 25/25 |
| 原生 TCP | 8/8 |
| 本机 HTTP | 8/8 |
| UI / MCP 生产构建 | 通过；Vite 仍提示主包超过 500 kB 阈值，无构建错误 |
| Mac Xcode 构建 | 最终资源重新构建通过，使用已有 Apple Development 签名；未启动或重新安装应用 |
| iOS Xcode 构建 | 最终资源的 iOS Simulator 构建通过；未安装或验证物理 iPhone |

完整日志：`/tmp/memocard-browser-final-verify.log`。最终自动化完成后，按顺序执行 `MEMOCARD_TEAM_ID=JDTJ6V4U4G pnpm build:mac` 与 `pnpm build:ios`，两项退出码均为 0，均明确返回 `BUILD SUCCEEDED`。日志分别为 `/tmp/memocard-browser-final-mac.log`、`/tmp/memocard-browser-final-ios.log`。此次仅构建，未启动 Mac 应用、安装模拟器或安装真机；构建通过不替代最新原生包的运行验收。

### Chrome 真实文件验收

使用 macOS 27.0、Chrome 153.0.8010.54 和 `http://127.0.0.1:4179/` 的生产静态资源完成以下操作。该页面不带本机 Web 模式标记，直接使用浏览器目录授权，不调用 Mac 应用的 HTTP 或 Swift 文件服务。所有操作仅针对新建的合成测试目录。

1. 通过真实系统选择器选择空目录 `new-vault`，批准 Chrome 对该测试目录的读写，成功建立 `.memocard/vault.json`、`notes` 和 `assets`。
2. 浏览器输入正文、添加 `browser-qa` 标签，通过真实图片选择器导入 PNG 并保存。磁盘检查确认生成 1 篇 Markdown、1 张图片，相对图片引用正确，附件字节与原测试图片完全一致。
3. 刷新页面后恢复目录连接，笔记正文、标签和图片仍可读取。
4. 设置中切换到 `shared-format` 测试库，批准其独立授权，成功读出原生共享 fixture 的中文正文和标签；原库草稿没有出现在另一个库。切回 `new-vault` 后，原库内容及草稿数量恢复。一次取消目录选择也保留了原库连接。
5. 在外部修改测试 Markdown 正文而不更新 `updatedAt`，重新选择原库后立即读出新增中文内容；再从浏览器打开、编辑并保存，原 ID、创建时间、标签、图片引用和外部新增段落全部保留。

验收中途一次目录选择未完成授权，取消并重新选择后出现 Chrome 权限提示并成功切换；未据此修改文件写入逻辑。系统自动化粘贴中文时遇到剪贴板超时，因此本轮不声称人工中文输入法验证通过；中文读取、解析、搜索及 IME 交互仍有自动化覆盖。

证据：`build/verification/browser-vault/chrome-local-note.png`、`file-check.json`、`test-directory.txt`。Becoming 工作区保持 clean。未修改或导入个人笔记，未停止用户原有的 Mac 本机 Web 服务。

尚未人工验证 Edge / Windows、浏览器关闭后权限恢复、设备间同步或浏览器崩溃写入。真实 iPhone、双端 iCloud 同步、备份恢复和 Becoming 项目读取脚本等原有未完成项保持不变。

## Sidebar-10 UI 改版（2026-09-28 15:56）

按用户授权，采用 [sidebar-10](https://ui.shadcn.com/view/new-york-v4/sidebar-10) 的导航布局，并适配为现有 Base UI 组件。新增 AppSidebar、DropdownMenu 和 Collapsible；下拉与折叠组件参考 shadcn 官方 Base UI registry。后续组件生成配置从 base-maia 调整为 base-nova / neutral，没有新增 Radix 或其他运行依赖。

- 左上角笔记库菜单提供能力允许的打开、创建、重新授权及设置入口；独立 Web 直接调用目录选择器，Mac 本机 Web 仍遵守其原生授权边界。回调保持同步执行以保留浏览器用户激活。
- 侧栏接入新建、搜索、所有笔记、草稿和可折叠标签；底部为设置及连接状态。桌面可以收起/展开侧栏，搜索条件和当前页保持不变。手机抽屉选择后关闭；搜索与新建分别交接到输入框和编辑器。移动导航按钮为 44px，顶部关闭按钮避开安全区域。
- 主内容区改为白色，侧栏为中性浅灰；深色模式采用中性深灰。强调色用于主要操作和选中，按钮、输入框、卡片、弹窗使用更紧凑的圆角和间距。light / blue / neutral / Geist / 10px 默认选项、外观存储和全部自定义选项保留。
- 保存、串行草稿、图片路径、hash 导航、深链接队列、切库 binding、过期请求保护、权限及不完整扫描提示复用原实现。没有增加模板中的 AI、收藏、分享等未实现入口。

### 验证

1. `pnpm verify` 全部通过，**221 项测试**：UI 164（新增侧栏组件 5 项、App 接线 6 项）、MCP 16、Swift 25、TCP 8、HTTP 8。TypeScript、ESLint、生产构建通过。最终仅追加手机触控区及 safe-area 样式后，两端构建脚本再次完成 TypeScript 与生产 UI 构建。
2. 最终 Mac Apple Development 签名构建和 iOS Simulator 构建均成功，未启动、关闭现有 App，也未安装真机。Web dist、Apple 共享资源及两个应用产物使用相同 JS/CSS 指纹（`index-1B0LCVmU.js`、`index-D1tMJlxs.css`）。仅有已有的 Vite 主包体积提示。
3. 浏览器检查桌面白色/浅灰布局、深色外观、目录菜单、390px 手机抽屉及导航关闭；手机导航按钮实际 DOM 高度为 44px。检查后已恢复浅色和原视口。
4. 使用原 Mac 本机 Web 服务的专用合成笔记库，确认原 3 条笔记、图片、6 个标签和 3 条草稿完整显示。通过新界面创建“Sidebar-10 界面验收”并添加“UI 验收”标签，正式保存后列表为 4 条，原有草稿仍为 3 条；磁盘检查确认 Markdown 正文和标签落盘。
5. 搜索“Sidebar-10”得到 1 条；收起/展开侧栏保留搜索内容，清空后恢复 4 条。控制台 warn/error 为空。菜单/页面检查采用浏览器键盘操作；自动化鼠标点击在此内置浏览器中未触发页面变化，不能据此声称该浏览器的鼠标交互人工验收完成。

证据：`build/verification/sidebar10/desktop-notes.png`、`dark-settings.png`、`mobile-navigation.png`、`saved-note-check.json`。日志：`/tmp/memocard-sidebar-final-verify.log`、`/tmp/memocard-sidebar-mac.log`、`/tmp/memocard-sidebar-ios.log`。

本轮没有重新执行 Chrome 真实目录授权或 iPhone 真机操作；相关文件核心未改动，新菜单的同步目录调用已通过组件与集成测试。原 M2–M5 和真机同步未完成项不因本次 UI 改版而变为完成。Becoming 工程保持 clean。


## 原模板细节对齐（2026-09-28）

根据用户对上一版细节杂乱的反馈，对照官方 new-york-v4/sidebar-10 registry 与浏览器实际渲染重新收敛 UI。本轮只改 App 的界面结构、AppSidebar、主题样式、ThemeSettings 及其交互测试；文件适配器、保存/草稿、目录授权、MCP 和 Swift 业务逻辑未改动。

- 桌面使用 256px 无边框侧栏、56px 无底边框顶栏、32px 导航行及 4px 行间距。库切换器恢复 20px 黑白图标、向下箭头和原模板字重，首个导航行 y=48px；主内容最大宽度 768px。默认导航选中改为中性灰，删除重复库面包屑、常态底部状态与字标。
- 设置改为扁平分组；六项外观设置统一为紧凑 Select。原模式、8 色、2 中性色、27 字体、7 档圆角与重置/持久化仍保留，默认 Light / Blue / Neutral / Geist / 10px 不变。原模板只有框架和占位区，此设置页是基于同一视觉规则的功能适配。
- 手机抽屉明确使用 288px（修正先前普通宽度被 Sheet variant 覆盖的问题），保留移动 44px 触控与安全区域。

验证：UI 15 个测试文件、164 项测试全部通过；TypeScript、ESLint、Vite 生产构建通过。Mac Apple Development 签名构建与 iOS Simulator 构建均返回 BUILD SUCCEEDED。日志：`/tmp/memocard-template-ui-tests.log`、`/tmp/memocard-template-lint.log`、`/tmp/memocard-template-mac.log`、`/tmp/memocard-template-ios.log`。

浏览器在实际本机 Web 打包页面读取原合成库，确认 4 条笔记、图片与 3 条草稿仍显示，搜索 Sidebar-10 得到 1 条，收起/展开保留查询，清除后恢复 4 条。设置页、浅深色选择、390px 手机抽屉及导航关闭完成检查；手机无水平溢出，抽屉 DOM 宽度 288px。控制台 warn/error 为空。交互检查用浏览器键盘，鼠标点击由组件测试覆盖；本轮不新增或修改测试笔记，不重做真实目录选择或 iPhone 真机验证。

截图：`build/verification/template-alignment/settings.png`、`notes.png`、`dark-settings.png`、`mobile-navigation.png`。未停止既有 Mac 应用和服务。Becoming 工作区保持 clean。原里程碑未完成项不因此改变。

## 2026-09-28：从原模板源码重建 UI

本节替代前两轮 base-nova / 局部样式对齐作为当前 UI 实现说明。官方源快照与许可保存在 `docs/ui-reference`，没有新增 Radix 运行依赖。重建 Sidebar 组合、AppSidebar、NavActions，统一 Button/Card/Input/Dialog/Menu/Select 的 new-york-v4 视觉；保留 Base UI 交互、目录授权、保存、草稿、图片及桥接逻辑。

验证结果：

- 166 项前端测试、TypeScript、ESLint 通过；新增侧栏边缘/快捷键、查询保持和页面操作回调测试。
- `MEMOCARD_TEAM_ID=JDTJ6V4U4G pnpm build:mac` 与 `pnpm build:ios` 均 BUILD SUCCEEDED。资源已重新打包；未重启用户的 Mac App，iOS 构建不代表真机验收。
- 1280×720 下与原模板对比：侧栏 256px、顶栏 56px、内容宽 768px、主要导航行位置及 32px 高度一致。业务内容有意替换模板占位内容。
- 在既有独立合成测试库中，通过打包页面保存“UI 重建验收”，磁盘 Markdown ID 为 `5bcb924b-896c-429d-aa5f-bebfdb572e80`，标签“界面验收”；笔记数从 4 到 5，原 3 条草稿保留。已有图片显示正常。
- 实际验证中文搜索、侧栏边缘收起/展开、Ctrl+B 与查询保持；390×844 移动抽屉跳转搜索后正确聚焦，无横向溢出。浏览器键盘交互完成，鼠标路径由交互测试覆盖。
- 打包页面控制台未发现 warn/error。两个旧页面在确认无编辑器或未保存输入后刷新，并恢复原标签筛选。Becoming 工作区仍干净。
- 证据：`build/verification/ui-rebuild/{reference,notes,editor,mobile}.png`、`metrics.json`、`saved-note-check.json`。本轮未执行 iPhone 真机、iCloud 跨设备同步或新的 MCP 回归。

## 2026-09-28：真实多级目录浏览

新增 listFolders 只读客户端接口，递归返回 notes 根目录、子目录及空目录，同时返回覆盖状态。浏览器和 Swift 核心均支持 queryNotes.folder：按完整路径边界匹配并包含后代，筛选进入游标条件摘要。Mac 本机 Web 白名单已接入；MCP 工具集保持不变。

侧栏新增独立目录树，使用 Base UI Collapsible 展开/折叠；点击目录筛选笔记，标签与所有笔记切换会清除目录筛选。目录不随搜索结果或分页而截断。此阶段只支持浏览已有真实目录，未提供创建、重命名、移动或删除目录，新增笔记仍保存至 notes 根目录。

验收：168 项前端测试、26 项 Swift 测试、8 项本机 Web 测试通过；lint 与 Mac 构建通过。独立测试库新增 notes/目录验收/项目/空目录 和一条合成笔记，原生 App 实测展开三级目录、显示空目录、点击项目后仅返回该目录的 1 条笔记。证据 build/verification/ui-rebuild/folders-native.png。未进行 iPhone 真机验证。

补充验证：Mac 与 iOS Simulator 最终构建通过。Chrome 本机 Web 实测展开至空目录、空目录返回空列表、点击项目返回 1 条笔记；最终侧栏回归 14 项通过。重启后本机服务地址为 http://127.0.0.1:55715，已通过 App 在 Chrome 打开授权会话；旧 55636 地址已失效。浏览器截图 folders-web.png。

## 2026-09-29：Obsidian 基础文件共用

按用户“让两个应用共用同一份笔记”“制定目标，开始实现”的授权完成基础兼容层。新建/普通文件夹使用 manifest v2；原 manifest v1 保持兼容。普通库取消固定 notes/assets 目录和笔记 UUID/日期字段要求；仅编辑正文保留原 YAML 前缀；本机身份映射、正文标签、基础 Wikilink/Markdown 内链和库内图片已接入 Swift、浏览器文件核心与共享界面。

最终 `pnpm verify` exit 0：UI 182、MCP 16、Swift 30、TCP 8、HTTP 8，共 **244 项测试通过**；TypeScript、ESLint、生产构建通过。`pnpm build:mac` 与 `pnpm build:ios` 均 BUILD SUCCEEDED，分别为本机 ad-hoc Debug 与 iOS Simulator 构建。现有大 JS chunk 提示仍存在，不是检查失败。

隔离本机 Web 使用生产 Swift 核心和打包 UI 验证合成 Obsidian 格式库：显示两条笔记、任意目录、正文/属性标签；图片解码成功；正文保存后磁盘内容更新，自定义 id、aliases、注释保持原样，草稿清零；浏览器 warn/error 为空。UI 内链发现 Web 模式没有订阅打开事件，已修复并增加 Web/browser 两种模式回归测试。

日志：`/tmp/memocard-obsidian-final-verify2.log`、`/tmp/memocard-obsidian-final-mac.log`、`/tmp/memocard-obsidian-final-ios.log`。合成库：`build/verification/obsidian-vault`。

独立 Chrome 的目录选择器此次未完成选择，已取消；没有把本机 HTTP 验证替代独立浏览器目录授权验证。未接触用户真实笔记，未在 Obsidian 应用中完成双向操作，未完成 iPhone/iCloud 同步。基础兼容不等于完整 Obsidian 功能兼容，也不代表 M2–M5 完成。详见 [兼容说明](OBSIDIAN_COMPATIBILITY.md)。

## 2026-10-09：统一 Base UI primitives

本轮以实际源码、锁文件及生产资源重新审计，发现此前运行组件仍使用 Radix；上文历史记录中的“保留 Base UI / 无 Radix”不能作为当前库选型证据。现已系统性替换为 `@base-ui/react@1.9.0`，移除 Radix 直接与传递依赖及旧 API 兼容路径，生成配置统一为 `base-nova`，并将源码/依赖/生产资源防回退检查接入验证流程。内容块菜单统一 4px 内边距，按最终确认恢复为 36px 单行；子菜单在桌面和窄屏均实测顶部对齐，弹层共用阴影 token。完整迁移范围、验证与未覆盖边界见 [BASE_UI_MIGRATION.md](BASE_UI_MIGRATION.md)。

移除块菜单的“块属性与更多操作”聚合入口，保留文字选区格式及底层 Markdown 支持。新增标题章节折叠，视图状态不修改 Markdown、不进入撤销历史；默认展开，支持嵌套与键盘操作。451 项回归通过，真实授权服务完成桌面与窄屏验收，详情见 [EDITOR_SECTION_FOLDING.md](EDITOR_SECTION_FOLDING.md)。
