# MemoCard 设计维护入口

当前只有一套产品 UI 和一套 Storybook。`apps/ui/src/main.tsx` 挂载共享 App 控制器与当前视图；`apps/ui/ui` 保存现行主题、基础控件、业务视图与原生表面适配，`apps/ui/src` 保留编辑器、文件/宿主桥接、草稿和共享业务。现行界面统一使用 `ui` 命名。

- [旧 UI 清理与入口迁移](ui-retirement-2026-10-25.md)
- [已使用组件维护表](component-inventory.md)
- [Token 消费与平台边界](token-consumption.md)
- [Token 定义和消费索引（生成）](token-coverage.generated.md)
- [平台组件归属](component-ownership.md)
- [基础规范](foundations.md)与[Token 定义规范](token-system.md)
- [组件文档维护](component-docs.md)与[Typography](typography.md)
- [当前整页状态与吉祥物预览](ui-preview.md)
- [原生排版职责](native-typography.md)
- [侧栏索引与原生订阅性能](performance.md)

## 唯一维护来源

| 内容 | 权威来源 | 消费边界 |
| --- | --- | --- |
| 当前语义色、字体标尺、尺寸、圆角、动效与 Tailwind 别名 | `apps/ui/ui/theme.css` | 产品与 Storybook 共用；同名 `@theme reference inline` 是编译别名 |
| 用户强调色与中性色 | `ui/web/web-palette.css`、`WebAppearance.tsx` | 8 种强调色、2 种中性色、明暗/系统及本机持久化 |
| UI 字体和圆角偏好 | `ui/preview-mode.tsx`、`preview-fonts.ts`、`preview-appearance.ts` | 产品和示例共用解析；产品存储与示例存储保持隔离 |
| 正文内容风格 | `src/features/typography/preferences.ts`、`TypographyProvider.tsx`、`ui/web/web-typography.css` | 字号、行宽、行高和段距；字体跟随 UI 外观 |
| 标签配色 | `ui/business/note-properties.css`、`src/TagColorStyles.core.tsx` | 按 vault 偏好渲染；同源 palette 输出供原生使用 |
| 组件局部布局与交互 | `ui/components`、`ui/business`、`ui/web` | 各组件维护自身局部变量、焦点、Portal 与响应式职责 |
| 原生侧栏基准 | `tokens/sidebar.tokens.json` | 只生成原生 Swift 常量与基准对照表；Web 直接消费现行主题 |
| 原生颜色与圆角 | `src/lib/ios-palette.ts`、`ios-theme.ts`、`ui/native/IOSAppChrome.tsx` | 从当前主题解析实际值，保留既有 surface payload 键 |
| 系统控件、安全区与原生度量 | SwiftUI / UIKit、`WebView.swift` | 系统拥有布局和行为；Web 消费 `--ios-top` / `--ios-bottom` 输出 |

`tokens/registry.json` 登记九类定义、显式覆盖、运行时输出、组件与平台所有权。颜色与外观覆盖必须声明来源；生成器检查未知引用、别名环、重复定义、无来源覆盖和生产可达性。完整逐文件消费索引来自唯一生产图，包含 `src` 与 `ui`，不会把测试、故事和状态预览当作产品消费者。

原生尺寸生成基准与当前 Web 主题分别维护：数值相同不代表跨端共享同一个消费入口。历史圆角和字体值仍可从设备偏好恢复；常规新选项以当前外观菜单为准。数据图表、syntax 和 brand 的定义状态不等于业务页面全部接入。

## 日常工作流

1. 修改权威主题或生产组件，同时更新维护表、registry 和必要的消费说明。
2. 执行 `pnpm tokens:build`、`pnpm icons:build`、`pnpm spacing:build`、`pnpm typography:build`。生成文件禁止手改，检查模式不得覆盖漂移内容；未变化的输出保留时间戳。
3. 启动 `pnpm --filter @memocard/ui storybook`。唯一配置为 `.storybook`，故事为 `ui/stories`；Foundations、Luma 控件、业务组件和整页示例共用当前源码。
4. 整页状态与流程使用 `pnpm --filter @memocard/ui dev:states`，入口为 `ui/preview`；fixture 只提供隔离内存库，不能代替真实文件系统验收。
5. 颜色或原生主题适配变化后执行 `pnpm palette:build`、`pnpm test:palette`；它通过真实 Chromium 采样当前主题，生成仅 Debug 使用的 Swift fixture。
6. 执行 `node scripts/check-current-ui-docs.mjs` 检查本目录明确标为现行的文档链接、源码路径与退役命令；历史报告不作为当前契约检查。
7. 执行 `pnpm verify:design` 与所改业务的定向回归，再按范围执行 `pnpm verify:web` 或原生检查。真实设备、权限、系统 picker、软键盘与同步独立验收。

`check:design-inventory` 检查唯一生产入口的可达模块、维护字段和引用路径；登记完整不表示所有状态都有独立 Story。内部控件可由所属组合维护，不能省略实际实现路径。Web 图标包括 Hugeicons；原生侧栏继续使用受维护的 Lucide 导出资源，SF Symbols 属系统职责。图标生成目录只登记自己实际解析的图标库，不把 Lucide 列表称为全量 Web 图标目录。

## 工程与验证边界

产品只有 `apps/ui/dist` 一份生产输出，Apple 与本机服务复制同一份资源。Storybook 和整页状态预览各有独立构建输出，不进入产品 bundle。旧纯视图、样式与旧开发目录已退役；保留的 `src/*core` 仍是当前生产依赖。

原生 Preview 继续复用 SwiftUI / UIKit 生产表面和隔离 `NativeHost(previewSurfaces:)`，不连接真实笔记库。浏览器窄屏、内存 fixture、编译与表面协议测试分别记录，不能互相替代。bundle 门禁按当前路由的静态依赖闭包约束 JS/CSS 及字体，并检查懒加载 CSS 不重复输出全局 utilities；数字不是首屏网络耗时或 LCP 实测。

历史设计记录保留作来源和演进证据，不作为现行入口说明：

- [双 UI 建立与迁移历史](ui-next.md)
- [Web/H5 同状态对照](ui-state-parity-2026-10-23.md)
- [新版功能复核](ui-next-review.md)
- [旧 token 工程说明](token-engineering.md)
- [设计与素材归档](mascots/README.md)

## 上游来源

- [Base UI](https://base-ui.com/react/overview/quick-start)
- [Tailwind CSS](https://tailwindcss.com/docs/theme)
- [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/)
- [Style Dictionary](https://styledictionary.com/reference/hooks/formats/)
