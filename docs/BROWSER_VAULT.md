# 独立 Web 与本地笔记库

MemoCard 的独立 Web 使用浏览器授权的本机目录。无需运行 Mac App，也不需要笔记后端。Mac / iPhone / Web 使用同一套 Markdown、图片和 `.memocard/vault.json` 格式。现有依赖 Mac 的本机 Web 仍保留，见 [LOCAL_WEB.md](LOCAL_WEB.md)。

## 使用

1. 在桌面 Chrome 或 Edge 中打开 MemoCard 网站。网站必须使用 HTTPS；本机开发可用 `http://127.0.0.1:5179/`。
2. 选择“打开笔记库”并授权包含 `.memocard`、`notes`、`assets` 的现有目录；首次使用选择“创建笔记库”，再选专用空目录。
3. 新建或编辑笔记，导入图片、添加标签，点击保存。Markdown 与图片直接写入选定目录。
4. 在设置中切换笔记库。取消选择或选到无效目录不会替换当前笔记库。
5. 下次打开同一网站时恢复最近目录；浏览器要求重新授权时，点击页面上的授权按钮。授权未恢复前不自动写文件。

普通 Markdown / Obsidian 文件夹不会自动转换为 MemoCard 笔记库。未知字段会保留；缺少必需元数据、格式损坏或重复 ID 会计入需处理数量，当前版本不自动修复或覆盖这些文件。

## 数据位置

- 已保存笔记：所选目录的 `notes`。
- 图片：所选目录的 `assets`，正文使用相对路径。
- 未提交草稿、目录句柄：当前浏览器、当前网站来源的 IndexedDB，不上传到网站服务器，不写入同步库。
- 主题：当前浏览器网站来源的本机偏好。

目录注册标识区分不同文件夹；即使两个恢复副本拥有相同 `vaultId`，也不会混用草稿。多标签页的未提交草稿分别保留。切换库后，旧编辑请求不能向新库提交。

清除网站数据、使用隐私窗口或更换网站域名/端口，会影响本机草稿和已记住的授权，不会删除笔记库中的 Markdown 与图片。因此应使用稳定的网站地址，重要内容及时提交为文件。

## 同步和保存边界

换电脑前需通过 iCloud Drive 或其他同步工具把笔记库下载到那台电脑，再在浏览器中选择该目录。网页不能通过 Apple 登录直接打开另一台电脑或云端的 iCloud Drive。保存成功代表本机文件写入完成，不代表云端或其他设备已经收到。

保存会先持久保存草稿，核对读取时的文件 SHA-256 指纹，并使用 `createWritable()` 暂存写流；提交前再次读取核对，只有 `close()` 成功才报告保存成功。同一来源的标签页通过 Web Locks 串行写入。外部重命名按笔记 ID 识别；外部删除的笔记不会从旧草稿自动重建。

浏览器没有 Apple `NSFileCoordinator` / `NSFileVersion` 能力，不能识别全部 iCloud 系统冲突版本，也没有与任意外部编辑器之间的原子比较替换。外部程序恰好在最后核对和提交之间写入仍可能发生竞争；不要把此浏览器适配当作已完成 M2 冲突恢复。扫描不能完整读取时拒绝正式保存，并保留草稿。新建笔记的文件句柄可能先创建空文件；正常失败会尝试清理仍为空的占位文件，浏览器进程在关闭写流前崩溃则可能留下空文件。此时草稿仍在浏览器存储中，空文件会作为需处理项而不会被当成有效笔记。

浏览器导入支持 PNG、JPEG、GIF、WebP，并实际解码检查文件；HEIC / HEIF 导入会提示先转换。原生客户端已有 HEIC 文件不会被改写，但 Chromium 可能无法预览。

仅加载授权笔记库 `assets` 内的受支持图片；不执行 Markdown HTML，不加载正文中的远程跟踪图片。Blob URL 仅由应用读取合法附件后生成，用完释放。文件接口只基于获授权的目录句柄，不接受任意绝对磁盘路径；符号链接是否能取得句柄由浏览器实现限制，Web 无法像 Swift 一样执行 `lstat`。同一路径图片被外部替换后，重新打开笔记或刷新页面读取最新图片。

## 构建与运行

```sh
pnpm install --frozen-lockfile
pnpm --filter @memocard/ui dev --port 5179 --strictPort
pnpm --filter @memocard/ui build
pnpm --filter @memocard/ui preview --port 4179 --strictPort
```

`apps/ui/dist` 是可部署到 HTTPS 静态托管的产物，不依赖 Node 笔记服务器。开发服务器只提供应用代码。当前交付没有公开发布网站，localhost 地址只能在运行它的电脑上使用；没有 Service Worker / PWA 离线安装保证。浏览器不支持目录读写时会显示明确说明，不用导入上传伪装为直接保存。

MCP 由独立 MemoCardService 或 Mac App 提供读取、新建、带版本检查的修改、移入回收站与恢复；使用服务连接时主客户端可以退出。浏览器不会在后台启动本机 MCP 服务。Becoming 的长期数据不由 Web 自动修改。

## 检查

自动化：`pnpm --filter @memocard/ui test` 和 `pnpm verify`。浏览器存储测试使用独立文件系统替身检验冲突与错误路径，不能替代真实目录选择和磁盘读写的手动验收。实际验证记录见 [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)。

参考：[Chrome 文件系统访问](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)、[目录选择兼容性](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)、[暂存写流](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable)。
