# 本地跨浏览器服务

`MemoCardService.app` 是独立的 macOS 菜单栏宿主。它以 Safari、Codex、Chrome 和 Edge 为兼容目标，通过随机 loopback 地址读写用户授权的 Markdown 笔记库；正式内容与附件仍直接保存在原文件夹。每个浏览器必须完成真实验收后才能标记为已支持。

## 构建与安装

```sh
pnpm build:service
pnpm install:service
~/.local/bin/memocard serve
```

本地安装位置为 `~/Applications/MemoCardService.app` 和 `~/.local/bin/memocard`。当前交付不包含 notarization、Homebrew、自动更新或公开下载。

CLI 仅把 `memocard-service://open-web` 交给指定 App。它不读取 App 容器、笔记库或控制 socket；停止服务、切换笔记库和退出只能从菜单栏完成。

## 笔记库与会话

- 服务可以在未选择笔记库时打开 Web，页面显示未连接状态并提供打开或创建入口。
- 目录选择由服务中的 `NSOpenPanel` 完成。授权通过 security-scoped bookmark 保存在服务自己的沙盒容器。
- 取消或无效候选不会替换当前笔记库。
- 成功切库时 HTTP 端口保持不变，旧 session 与未使用 token 全部失效；发起切换的标签页通过新的 `reconnectUrl` 换取会话。
- 服务、Mac App 和 Chrome / Edge 直连模式各自保存草稿和授权。它们只通过 Markdown 与附件共享正式内容。

## 安全边界

服务只监听 `127.0.0.1`，使用随机端口、精确 Host/Origin、一次性两分钟 fragment token、HttpOnly SameSite=Strict cookie、严格 CSP 和接口 allowlist。服务不记录 token、bookmark、正文或图片内容。

## 验证

```sh
pnpm test:service
pnpm build:service
codesign --verify --deep --strict build/local-service/MemoCardService.app
```

自动化不能替代真实目录选择。发布支持声明前，还需要在 Safari、Codex、Chrome 和 Edge 中分别完成建库、切库、编辑、图片、重启恢复和原文件写回验证。
