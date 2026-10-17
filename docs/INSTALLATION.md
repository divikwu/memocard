# 本机构建、安装与重新签名

此文档用于 M1 开发验证。源码和生成工程已提供；真机安装是否通过，以 IMPLEMENTATION_STATUS.md 的证据为准。

## Mac

1. Xcode Settings → Accounts 登录自己的 Apple ID，确认可使用的 Development Team。
2. 在仓库根目录运行 `pnpm install --frozen-lockfile`。
3. 运行 `MEMOCARD_TEAM_ID=你的团队ID pnpm build:mac`。
4. 打开 `build/apple/Build/Products/Debug/MemoCard.app`。
5. 在应用内选择专用空测试目录创建库。目录授权无法恢复时重新选择同一个文件夹，不删除数据。

构建未做公证，也未用于公开分发。相同 bundle ID 为 `dev.divikwu.memocard`；同一账号重编译时保持 bundle ID 和签名身份一致。

## iPhone 真机

1. 通过数据线连接并解锁 iPhone，完成系统“信任此电脑”；若系统要求，按 Apple 提示启用开发者模式。不要擦除、重置或注销设备。
2. 运行 `xcrun devicectl list devices` 确认设备 available，记录 UDID（不提交到 Git）。
3. 运行以下命令，环境变量只对本次构建生效：

```sh
MEMOCARD_TEAM_ID=你的团队ID MEMOCARD_IOS_UDID=你的设备UDID pnpm build:ios
xcrun devicectl device install app --device 你的设备UDID build/apple/Build/Products/Debug-iphoneos/MemoCard.app
xcrun devicectl device process launch --device 你的设备UDID dev.divikwu.memocard
```

也可以运行一次 `pnpm build:ios` 生成界面资源后，打开 `apps/apple/MemoCard.xcodeproj`，选择 MemoCardiOS scheme、自己的 Team 和真实 iPhone，再 Run。Xcode 可能需要用户亲自完成账号或信任操作。

首次开发安装如被 iOS 阻止启动，在手机「设置 → 通用 → VPN 与设备管理 → 开发者 App」按系统提示信任自己的开发者身份，再打开 App。应用已启用 `UIFileSharingEnabled` 与原位打开文档；放入 App `Documents` 的专用体验库可通过「我的 iPhone → 记忆卡」找到。在 App 点击「选择已有文件夹」，选择该体验库并点「打开」。此位置是手机本地目录，与模拟器副本之间没有自动同步。

4. 在 Mac 创建 iCloud Drive 专用测试笔记库，等待 `.memocard/vault.json`、`notes`、`assets` 出现。iPhone 使用“选择已有文件夹”；元文件未下载时不要创建替代库。
5. iPhone 新建中文笔记并通过系统相册附加图片，Mac 确认内容与图片后编辑，再在 iPhone 确认更新。记录设备系统、构建版本、实际等待与异常；模拟器不算通过。

## 免费账号到期

Apple Personal Team 设备配置通常约 7 天到期，需用同一账号、Team、bundle ID 重新构建安装。以 Xcode 实际签名结果为准；本项目不购买会员、不承诺长期免维护安装。[Apple 账号说明](https://developer.apple.com/help/account/basics/about-your-developer-account)

优先直接覆盖安装，不先删除 App。删除 App 会清除其本机数据（包括草稿、索引、偏好和目录授权），但不应删除用户另存的 iCloud Drive 笔记库。授权 bookmark 失效、应用重装或文件夹移动后，重新通过系统选择器授权原目录。实际保留行为需要真机验收，不能仅凭文档保证。

## 模拟器

不设置设备变量时，`pnpm build:ios` 产物为 `build/apple/Build/Products/Debug-iphonesimulator/MemoCard.app`。可用 Xcode 或 `xcrun simctl install <模拟器UUID> ...` 安装并启动。这里只检查编译、打包资源和手机布局，不代表免费签名或 iCloud 同步可用。

## 故障与恢复边界

- 页面空白：确认使用构建脚本打包 Web 资源、完整签名 entitlements；不要用关闭 Sandbox 的方式掩盖问题。
- 无法读取目录：在应用内重新授权；保留本机草稿，不从缓存重建被外部删除的文件。
- MCP 不可用：保持 Mac App 运行，检查设置显示已开启；Node 每次调用读取最新 `connection.json`，不要复制旧令牌。
- 文件尚未下载、重复 ID 或格式损坏：M1 只报告状态并保留原文件，完整处理入口在 M2/M3。
- 当前没有导出/恢复功能。计划中的完整备份、恢复到空目录及校验验收仍未实现，不能把 Finder 复制成功视作已完成备份关卡。
