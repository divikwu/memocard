# 记忆卡 · MemoCard

个人使用的 Mac / iPhone / 独立 Web Markdown 笔记应用，并提供独立菜单栏服务支持 Safari、Codex、Chrome 和 Edge 访问本机笔记库。正文与图片保存在用户授权的文件夹，目标是用 iCloud Drive 同步；Mac App 提供本机只读 MCP。


现已支持直接打开 Obsidian / 普通 Markdown 文件夹：无 YAML 的笔记、原目录、库内图片、正文标签和基础 Wikilink。仅改正文时保留原属性与注释。兼容范围和验收边界见 [Obsidian 共用说明](docs/OBSIDIAN_COMPATIBILITY.md)。新建库采用普通 Markdown，旧 MemoCard 库继续兼容。

**当前是 M0/M1 平台验证版，不是已完成的首版。** 真实 iPhone 安装和双端 iCloud 同步关卡通过前，不启动依赖它的数据功能阶段。用户另行授权的 UI 重设计与本机外观设置已落地。当前能创建/打开笔记库、输入 Markdown、导入图片、保存草稿、搜索和通过 MCP 读取。SQLite、冲突解决、统计、笔记库备份恢复和 Becoming 项目脚本尚未交付。

界面采用 **shadcn/ui new-york-v4/sidebar-10 原模板结构，Base UI + Tailwind CSS 4**。白色内容区、浅灰侧栏和紧凑控件；默认保留 Becoming 的浅色、Blue、Neutral、Geist、10px 选项，设置页支持浅深色/系统模式、8 种强调色、2 种中性色、27 种标题/正文字体选项及7档圆角，独立保存在当前设备。左上角菜单管理笔记库，侧栏包含搜索、笔记、草稿与可折叠标签；桌面可收起侧栏，手机使用抽屉导航。字体随应用打包，中文使用系统字体回退。`components.json` 与 `src/components/ui` 保存可维护的组件源码，本次不修改 Becoming 工程。

唯一执行依据：[PROJECT_PLAN.md](PROJECT_PLAN.md)。当前证据与限制：[实施状态](docs/IMPLEMENTATION_STATUS.md)。

主页默认按更新时间显示笔记，可切换「已固定」及卡片 / 列表布局。固定与取消固定仅在笔记详情右上角操作。固定记录保存在笔记库的 `.memocard/pins.json`，不改正文或笔记更新时间；通过 MemoCard 重命名时保留固定状态。普通 Markdown 库按路径共享固定记录，外部移动文件不会自动迁移固定记录。

主页快速输入支持多行文字、标签和图片；点击「记录」或使用 `⌘ / Ctrl + Enter` 正式保存。成功后清空输入并回到最近更新第一页，失败时保留内容。未提交内容仅在当前页面内保留，不自动保存草稿；仅选标签不会创建空笔记，未填写标题时沿用「新内容」。图片选择后写入附件目录，点击「记录」后才写入笔记。笔记详情编辑器仍支持本机草稿恢复。

笔记详情菜单支持删除笔记，左下角笔记库菜单中的「回收站」可查看只读内容并恢复，也可在确认后永久删除。恢复会保留原文和附件；同名文件按新名称恢复，不覆盖现有内容。永久删除只移除对应的回收笔记，图片附件保留。回收目录内的 Markdown 与身份信息随笔记库保留。

## 开发

本次验证环境：Node 24.18.0、pnpm 10.34.1、Xcode 27.0；最低系统目标 macOS 14 / iOS 17。

```sh
pnpm install --frozen-lockfile
pnpm verify
MEMOCARD_TEAM_ID=你的开发团队ID pnpm build:mac
open build/apple/Build/Products/Debug/MemoCard.app
pnpm build:ios
```

`build:ios` 默认构建模拟器。真实设备与重新签名步骤见 [安装说明](docs/INSTALLATION.md)。`build:mac` 未设置团队时使用本机 ad-hoc 签名；稳定目录授权验证使用相同 Apple Development 签名身份。没有自动创建付费资源或公开分发。

`build:mac` / `build:ios` 先构建 React 静态资源，再复制进应用并生成 Xcode 工程。页面通过 `memocard-ui://app` 加载，应用运行不依赖 Vite。`scripts/generate-project.py` 只使用 Python 标准库，不依赖 xcodegen；工程变更应编辑该脚本后重新生成。

### 独立 Web

桌面 Chrome / Edge 可直接选择、创建、切换本机文件夹，无需 Mac App。Markdown 与图片写入所选目录；草稿和目录授权保存在当前浏览器的 IndexedDB。启动下方开发服务器即可使用，生产构建 `apps/ui/dist` 可部署到 HTTPS 静态托管。本次没有公开发布网站；其他电脑需要同步好自己的本地文件夹后单独授权。详见 [独立 Web](docs/BROWSER_VAULT.md)。

### 本地跨浏览器服务

Safari、Codex、Chrome 和 Edge 的推荐本机入口是独立菜单栏应用 `MemoCardService.app`。运行 `pnpm build:service && pnpm install:service` 安装后，用 `memocard serve` 请求服务打开经过鉴权的 loopback 页面。网页可通过系统目录选择器打开、创建或切换笔记库，正式 Markdown 和附件直接写回原文件夹；切库不更换端口，但会让旧标签页的会话失效。详细构建、安全边界与验收要求见 [本地跨浏览器服务](docs/LOCAL_SERVICE.md)。

### 本机 Web

推荐通过 `MemoCardService.app` 或 `memocard serve` 打开本机 Web。浏览器只连接菜单栏服务提供的 listener，并使用服务维护的多 Vault 列表；Mac App 设置中的“在浏览器中打开”和兼容 URL `memocard://web` 会转交给该服务，不再创建另一套网页会话或端口。浏览器复用同一套界面和笔记文件，可以查看、新建、编辑、保存草稿和导入图片。Mac App 仍在原生界面中管理自己的目录授权和只读 MCP。

网页资源随宿主打包，不依赖 Vite 或 Node 后端。地址使用系统分配的本机端口；宿主重启后必须重新打开，旧页面不能通过“重试”发现新端口。不要保存或分享带一次性授权参数的链接。详细边界与验证见 [本机 Web](docs/LOCAL_WEB.md)。

### 开发界面预览

在仓库根目录启动开发服务器，并保持终端运行：

```sh
pnpm --filter @memocard/ui dev --port 5179 --strictPort
```

打开 <http://127.0.0.1:5179/>。不要直接用 `file://` 打开 `apps/ui/index.html`，源码入口需要 Vite 处理。此地址现在是独立 Web：受支持浏览器可以直接授权并读写本机文件夹。不支持目录访问的浏览器会显示兼容性说明。

### 同区实时编辑

笔记编辑器已取消“编辑 / 预览”标签页。标题、粗体、斜体、代码和本地图片在同一编辑区显示；编辑某一行时显示该行 Markdown 标记，移开光标后恢复排版。原始 Markdown 始终用于草稿和保存，未编辑的段落不会经过富文本转换。支持撤销/重做，`⌘Enter` 保存；`⌘` / `Ctrl` + 单击安全外链可用系统浏览器打开。引用式链接/图片及未支持的扩展语法保留为可编辑原文。

```text
apps/ui                 共享 React 界面；原生桥 / 本机 Web / 浏览器目录适配
apps/apple              SwiftUI/WKWebView、目录授权、Mac loopback 服务
packages/native-core    Swift/Yams 文件核心与本机草稿
packages/contracts      TypeScript 契约、协议说明与示例
apps/mcp                官方 MCP SDK stdio 适配器
tests/fixtures          仅合成数据
```

M1 扫描文件生成内存视图，没有伪装成已完成的 SQLite 索引。`coverage.complete` 仅描述本机可读覆盖，不代表 iCloud 已上传或其他设备已收到。

## 测试笔记库与 MCP

先在 Mac 应用点击“创建笔记库”，选择专用空目录。真机验证时在 iCloud Drive 中新建专用测试目录，再由 iPhone 选择同一库；不要导入真实个人笔记。

Mac 设置中开启读取，选择笔记库、Git 和 iCloud 之外的本机配置目录。配置包含敏感令牌，不提交、不分享。

```sh
pnpm --filter @memocard/mcp build
pnpm --filter @memocard/mcp smoke --connection-file /绝对路径/connection.json
```

详细接口见 [MCP 接入](docs/mcp.md)。这里的 smoke 是 M1 本机平台验证，不代替计划要求的 M4 `pnpm memocard:read` Becoming 实际脚本验收。

## 数据与安全边界

原生与本机 Web 文件操作在 Swift 中协调执行；独立 Web 使用浏览器目录授权直接写文件，Node 不直接写笔记。Mac 启用 App Sandbox，目录经系统选择器授权；MCP 连接配置为 `0600`，TCP 只绑定 `127.0.0.1`。本机 Web 使用独立 HTTP 服务和授权，不复用 MCP 令牌或扩大其只读权限。WKWebView 与独立 Web 生产页面 CSP 禁止数据网络请求；本机 Web 只允许同源接口。页面禁止 frame 和表单提交，Markdown 原始 HTML 不执行。

笔记文件是事实来源。当前版本对不完整扫描采取保守处理：保留本机草稿，拒绝正式覆盖保存。笔记库备份/恢复尚未实现，请勿将此验证版作为唯一笔记副本。
