# MemoCard 设计规范 v1

本目录是全平台设计规则的现行入口。规范覆盖桌面 Web、H5、本机 Web、macOS WebView，以及 iOS 原生外壳与内嵌 Web；首个完成实现和预览闭环的组件为侧栏。

- [基础规范与维护边界](foundations.md)
- [组件归属表](component-ownership.md)
- [侧栏规格与验收清单](components/sidebar.md)
- [可移植 token 对照表（生成）](TOKENS.generated.md)
- [本轮验证记录](validation.md)

## 唯一维护来源

| 内容 | 权威来源 | 消费方式 |
| --- | --- | --- |
| 圆角选项、侧栏静态基准 | `tokens/sidebar.tokens.json`（DTCG） | Style Dictionary 生成 CSS、TS、Swift 和对照表 |
| 动态颜色、强调色、中性色、Web 字体与外观选择 | `apps/ui/src/styles.css`、`features/theme/ThemeProvider.tsx` | CSS 计算后经现有 palette / rowRadius bridge 传原生 |
| 系统控件尺寸、材质与行为 | 平台系统和平台适配代码 | 使用系统 API，避免复制系统内部数值 |
| 品牌图形 | Web Lucide 依赖与 `scripts/generate-sidebar-icons.mjs` | 同源导出原生侧栏图标 |

每项设计值只有一个维护位置。v1 没有复制全部颜色到 Swift，也没有迁移全部历史 CSS；未来迁移一个类别时，必须同时删除其旧定义并更新此表。

## 日常工作流

1. 修改 token 源或现行组件规格，执行 `pnpm tokens:build`。
2. Web 执行 `pnpm --filter @memocard/ui storybook`，原生在 Xcode 打开 `NativeSidebar.swift` 的 Canvas。
3. 修改颜色 CSS 后执行 `pnpm palette:build`；它通过锁定的 Chromium 和生产 `readIOSPalette()` 采样默认浅/深色，生成仅 Debug 使用的 Swift fixture。普通 token 构建不依赖浏览器。
   采样的强调色、中性色和圆角来自生产 `DEFAULT_APPEARANCE`；无变化时保留 Swift 文件时间戳。
4. 执行 `pnpm verify:design` 和相关组件/bridge 回归，再在真实 App 验证。生成文件随源文件一起提交。
5. 升级 Lucide 或修改侧栏图标映射后执行 `pnpm icons:build`；`icons:check` 逐字节检查 SVG 与 Xcode 资源 metadata，并已接入设计 CI。

生成文件禁止手改。`tokens:check`、`icons:check`、`palette:check` 只检查，不覆盖现有文件；三个生成命令都在内容相同时保留时间戳。设计 CI 的 `test:palette` 用一次真实采样同时验证 fixture 漂移与只读／mtime 行为。Storybook Controls 用于预览组件参数；正式设计改动回到源文件，不自动写回生产布局。

平台输出只暴露各端实际消费的值。基础 spacing 用于别名解析，原生专用的缩进与字号不额外生成 Web CSS 变量，避免把开发规范和未使用的变量带入生产包。

## 工程边界

Storybook、故事、模拟数据和浏览器测试只用于开发，不进入生产入口或原生 Web 资源。现有 `apps/ui/preview` 保留整页状态与流程验收职责。原生 Preview 使用生产组件及隔离的 `NativeHost(previewSurfaces:)`，不连接真实笔记库或启动服务。

基础 token 与 Web / 原生组件实现分离；不新增跨端组件 DSL 或运行时 token 服务。Figma 同步、全量组件迁移及原生 Debug 目录留待有实际消费需求时推进。token 整理不作为性能改善证据。

侧栏的标签树索引、原生状态订阅及可复现性能基线见 [performance.md](performance.md)。性能计时与行为回归分别记录；CI 检查确定性扫描／通知次数和真实 bridge 行为，不设置依赖机器速度的毫秒门槛。

## 上游参考

- [DTCG 2025.10 格式](https://www.designtokens.org/tr/2025.10/format/)
- [Style Dictionary 平台输出](https://styledictionary.com/reference/hooks/formats/)
- [Base UI 样式](https://base-ui.com/react/handbook/styling)
- [Apple 系统控件与平台外观](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
