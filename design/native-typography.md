# 原生排版工程说明

Web 的现行排版见 [Typography](typography.md)。iOS 系统文字继续采用 SwiftUI / UIKit 和 Dynamic Type，不用 Noto Sans Web 字体替换系统导航、搜索输入或菜单字体。

## 原生字号与单位

[sidebar.tokens.json](tokens/sidebar.tokens.json) 的尺寸基准只生成 [DesignTokens.generated.swift](../apps/apple/Sources/DesignTokens.generated.swift) 和 [基准对照表](TOKENS.generated.md)。生成常量不代表有实际消费者；精确归属见[消费映射](token-consumption.md)。

| Token | 基准 | 当前用途 |
| --- | --- | --- |
| `sidebar.mobileFontSize` | 16pt | 原生侧栏正文/标签；按 body 文字大小缩放 |
| `sidebar.brandFontSize` | 14pt | 品牌文字；按 subheadline 缩放 |
| `sidebar.captionFontSize` | 12pt | 分组标题、数量、状态；按 caption 缩放 |
| `sidebar.desktopFontSize` | 14px 历史基准 | 无当前原生直接消费者，不是生效的 14pt 字号 |

[NativeSidebar.swift](../apps/apple/Sources/NativeSidebar.swift) 通过 `@ScaledMetric` 解析实际文字和图标。视觉图标、文字、命中目标、缩进和最小行高分别维护；基准 px、Swift 逻辑点和物理像素不能直接换算为同一规则。

## 源码与索引

- [NativeChrome.swift](../apps/apple/Sources/NativeChrome.swift)：系统导航、操作菜单、原生搜索/快速记录外壳和 Preview。
- [NativeDesignedPanel.swift](../apps/apple/Sources/NativeDesignedPanel.swift)：搜索结果、输入区和原生自定义内容的现有字体/间距。
- [IOSAppChrome](../apps/ui/ui/native/IOSAppChrome.tsx)：从共享 App 状态发布原生 chrome 与列表表面；读取当前外观与已解析的主题。
- [typography-usage.generated.json](typography-usage.generated.json)：当前源码扫描得到的 Swift 文字表达式和位置。`pnpm typography:build` 更新，`pnpm typography:check` 检查漂移。

局部 `.system(size:)`、条件字号和 `lineSpacing` 是现有实现，不能据扫描索引提升为全局字号角色。Swift `lineSpacing` 是额外行距，不等于 CSS 完整行高；系统 `.headline`、`.caption` 等保持平台语义。

## 外观与验证

UI 主题由 WebAppearance 与 CSS 解析。原生 chrome 接收 light / dark / system；自定义表面接收 RGBA palette 与实际 `rowRadius`。Debug 预览颜色和默认圆角由 [独立 sampler](../apps/ui/ui/native/palette.html) 生成，不能以原生尺寸 JSON 的旧圆角值替代当前主题采样。

执行 `pnpm palette:build`、`pnpm test:palette`、`pnpm test:native-surfaces` 和相应 iOS 构建。Xcode Preview、真实 Simulator surface probe、WKWebView 与真机分别验证。系统文字放大、输入法、键盘、辅助技术和真实设备未验收时单独注明，不用 Web 浏览器结果代替。
