# 记忆卡 · MemoCard

个人使用的 Mac / iPhone / 独立 Web Markdown 笔记应用，也保留依赖 Mac 的本机 Web。正文与图片保存在用户授权的文件夹，目标是用 iCloud Drive 同步；Mac 提供本机只读 MCP。

**当前是 M0/M1 平台验证版，不是已完成的首版。** 真实 iPhone 安装和双端 iCloud 同步关卡通过前，不启动依赖它的数据功能阶段。用户另行授权的 UI 重设计与本机外观设置已落地。当前能创建/打开笔记库、输入 Markdown、导入图片、保存草稿、搜索和通过 MCP 读取。SQLite、冲突解决、回收站、统计、备份恢复和 Becoming 项目脚本尚未交付。

界面采用 **shadcn/ui new-york-v4/sidebar-10 原模板结构，Base UI + Tailwind CSS 4**。白色内容区、浅灰侧栏和紧凑控件；默认保留 Becoming 的浅色、Blue、Neutral、Geist、10px 选项，设置页支持浅深色/系统模式、8 种强调色、2 种中性色、27 种标题/正文字体选项及7档圆角，独立保存在当前设备。左上角菜单管理笔记库，侧栏包含搜索、笔记、草稿与可折叠标签；桌面可收起侧栏，手机使用抽屉导航。字体随应用打包，中文使用系统字体回退。`components.json` 与 `src/components/ui` 保存可维护的组件源码，本次不修改 Becoming 工程。

唯一执行依据：[PROJECT_PLAN.md](PROJECT_PLAN.md)。当前证据与限制：[实施状态](docs/IMPLEMENTATION_STATUS.md)。

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

### 本机 Web

在 Mac 应用中选择笔记库，然后进入设置，点击“在浏览器中打开”。需要使用 Codex 内置浏览器等其他浏览器时，点击“复制访问链接”，在 2 分钟内粘贴打开。浏览器复用同一套界面和笔记文件，可以查看、新建、编辑、保存草稿和导入图片；应用关闭或停用 Web 后无法继续读写。切换笔记库后需从应用重新打开，旧网页不能继续写入其他库。

网页资源随 Mac 应用打包，不依赖 Vite 或 Node 后端。地址使用系统分配的本机端口，请通过应用入口重新打开，不要保存带一次性授权参数的链接。文件夹选择和 MCP 开关在 Mac 应用内操作。详细边界与验证见 [本机 Web](docs/LOCAL_WEB.md)。

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

笔记文件是事实来源。当前版本对不完整扫描采取保守处理：保留本机草稿，拒绝正式覆盖保存。备份/恢复尚未实现，请勿将此验证版作为唯一笔记副本。
