# Obsidian 共库实测记录

日期：2026-09-29。结论：真实 Obsidian 与生产存储核心的本机 Web 界面共库通过；Mac 原生和独立 Chrome 已在后续复测恢复并通过；iPhone 发布验收尚未完成。

## 环境与数据

- macOS 27.0（26A428），Obsidian 1.12.7，Xcode 27.0（27A266a）。
- 合成库：`build/verification/obsidian-vault`，没有使用个人笔记。
- 本机 Web：`build/verification/ObsidianHost`，本轮重新编译生产 `VaultStore`、`LocalWebServer`，加载最新 `apps/ui/dist`；监听 loopback 55816，使用一次性授权链接。
- 这是隔离验收程序，不代表实际 Mac App 已启动，也不代表 Chrome File System Access 授权通过。

## 已通过的实际操作

1. 在 Obsidian 打开合成库，编辑 Home.md，新增 `Obsidian 实测写入 2026-09-29`。MemoCard 页面读取并显示该内容。
2. 从 MemoCard 编辑同一 Home.md，保存 `MemoCard Web 实测回写 2026-09-29`。磁盘内容正确，Obsidian 无需手动重开即显示新内容；没有注入 YAML。
3. MemoCard 标准 Markdown 相对链接“回到首页”打开 Home.md；Wikilink“打开目标笔记”打开 Projects/Target.md。编辑器分别显示根目录和 Projects。
4. `![[pixel.png]]` 从 Images/pixel.png 解析并实际解码：complete=true，naturalWidth=1，naturalHeight=1；本轮页面 warn/error 日志为空。该 1×1 合成图验证加载链路，不评估视觉质量。
5. MemoCard 保留未保存草稿时，在真实 Obsidian 修改 Target.md；MemoCard 保存提示“文件已在其他位置修改，原文未被覆盖”。磁盘保留 Obsidian 内容，本机草稿保留 MemoCard 内容；原 id、aliases、tags 和 YAML 注释逐字保留。
6. 在 Obsidian 将 Target 重命名为 RenamedTarget。实际文件变为 Projects/RenamedTarget.md，Obsidian 自动将 Home 的 Wikilink 改为 `[[RenamedTarget|打开目标笔记]]`。MemoCard 自动刷新，笔记数仍为 2；身份映射的新路径和旧草稿使用相同 ID；点击更新后的链接可继续打开旧草稿。此案例的正文修改先被扫描，再单独重命名，不代表“移动与修改同时发生”也可保留身份。

本轮证据留在忽略目录 `build/verification`：`obsidian-received-memocard.png`、`obsidian-conflict.png`、合成 Markdown 文件及 `host-local` 中的草稿/身份映射。冲突草稿有意保留，便于复查。

## 首轮环境阻塞（后续恢复情况见下文）

- **Mac 原生 App**：最新 Debug ad-hoc 构建启动后无窗口；更换已有 Apple Development 证书重新构建成功，仍无窗口。两次进程采样均停在进入应用代码前的 `_libsecinit_appsandbox` → `_xpc_pipe_routine`。没有移除沙盒或更改系统安全设置；具体系统根因尚未确定。日志：`/tmp/memocard-obsidian-signed-mac.log`，采样：`/tmp/memocard-native-sample.txt` 和 `/tmp/memocard-native-signed-sample.txt`。
- **独立 Chrome**：127.0.0.1:5183 页面正常，系统选择器可定位合成目录，但 Select / New Folder 持续 disabled；取消后页面正确报告未完成授权。没有进入后续站点编辑许可，不能认定浏览器目录读写成功。
- **iPhone / iCloud**：`xcrun devicectl list devices` 报告已登记 iPhone 为 unavailable；已请用户连接、解锁并信任 Mac。未使用模拟器代替真机同步验收，也未改动个人 iCloud 库。
- **浏览器崩溃恢复**：尚未实测。

后续需在原生启动与目录选择恢复后，重做 Mac App + 独立 Chrome 授权读写；iPhone 连接后安装真机构建，并在专用 iCloud 合成库验证双端更新和离线恢复。

## 后续复测：Mac 与 Chrome 恢复（2026-09-29）

- **Mac 原生通过**：使用上一轮 Apple Development 签名构建重新启动，正常显示 UI；通过系统目录选择器授权同一个合成库，加载 2 条笔记。在 Projects/RenamedTarget.md 保存 `Native Mac verified 20260929`，磁盘验证正文和原 YAML 均正确。正常退出后再次冷启动，自动恢复库并读取保存结果。没有停系统服务、移除沙盒或修改系统权限。此前启动停滞未再出现，尚不能区分签名延后生效或系统服务暂态，因此不宣称已定位系统根因。
- **Chrome 独立模式通过**：Chrome 153.0.8010.54，127.0.0.1:5183。旧窗口可复现 Select / New Folder 禁用；用 Cmd+N 新建窗口，在同一站点、相同选择器参数、同一目录下，两按钮恢复正常。点击 Select 后完成“Allow this site to edit files?”授权，实际加载 2 条笔记。保存 `Chrome folder mode verified 20260929`，磁盘与 Mac 原生界面均出现该标记，原 YAML 注释及属性不变；刷新浏览器后自动恢复库与修改结果。恢复只改变了浏览器窗口，没有修改文件选择 API 或安全配置。这是已验证的窗口状态恢复方法，Chrome 内部根因未确定。
- 现有授权取消提示补充“选择按钮灰色时，在 Chrome / Edge 新窗口重试”，避免用户反复在异常窗口操作。
- 追加截图：`build/verification/native-mac-verified.png`、`build/verification/chrome-folder-verified.png`。最小诊断页位于 `build/verification/picker-diagnostic`（仅诊断用途，忽略目录）。
- 本次没有可稳定复现的应用代码缺陷，系统窗口暂态无法用单元测试可靠覆盖；回归依据为上述真实 UI 操作、冷启动、刷新和磁盘校验。

当前剩余：iPhone/iCloud 双端同步、浏览器崩溃恢复。前述 Mac 启动和独立 Chrome 目录授权不再是当前阻塞。

## 卡片图片闪动修复

2026-09-29：后台刷新会重新创建 Markdown 的内联 `img` 组件类型，导致已解析图片卸载后重新解析。1×1 测试图在无 src 的占位行和加载结果之间切换，实测卡片高度从 365.75px 变为 339px，正文没有变化。

将图片 renderer 提升为模块级稳定组件，保留轮询和图片源变化时的重新解析。新增两个回归测试先复现失败，修复后 UI 184 项测试、TypeScript 构建通过。当前本机 Web 页面已加载新构建，多次 DOM 采样均为卡片高度 339px、图片节点替换 0 次、高度变化 0 次，控制台 warn/error 为空。截图：`build/verification/markdown-flicker-fixed.png`。Mac 打包应用需下次构建才能包含此修改。

## 多级标签导航验收

2026-09-29：侧栏移除物理目录分类，改为 `/` 分隔的标签树。父级筛选包含后代，计数按笔记去重；没有重排磁盘文件。合成测试新增 NestedTags.md，同时拥有 工作/项目/设计 和 工作/项目/开发。实际页面中“工作”为 2 篇、“项目”为 1 篇；点击“工作”显示 2 篇，三级“设计”显示 1 篇，展开/收起正常，控制台 warn/error 为空。新笔记继承选中标签的行为由 UI 集成测试覆盖。

`pnpm verify` 全部通过：UI 185、MCP 16、Swift 31、TCP 8、HTTP 8，共 248 项；开发签名 Mac 构建通过。当前验收页面更换为重新编译的生产核心，地址为 http://127.0.0.1:55838/#/notes。截图：`build/verification/nested-tags-verified.png`。
