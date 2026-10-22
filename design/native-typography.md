# 原生排版工程说明

本页记录原生侧栏字号基准，以及 Apple Sources 中现有文字写法。通用文字体系见 [Typography](typography.md)；逐项定义、平台职责与消费关系仍以 [token 覆盖清单](token-coverage.generated.md) 和 [消费映射](token-consumption.md) 为准。

## 原生字号基准

基准由 [sidebar.tokens.json](tokens/sidebar.tokens.json) 定义，生成至 [DesignTokens.generated.swift](../apps/apple/Sources/DesignTokens.generated.swift)。逻辑基准需区分平台单位与实际消费者；生成 Swift 常量不代表原生代码已使用该常量。

| Token | 基准数值 | 单位与实际用途 |
| --- | --- | --- |
| `sidebar.mobileFontSize` | `16` | 原生 pt；侧栏正文与标签名称，按 body 文字大小缩放。 |
| `sidebar.desktopFontSize` | `14` | Web px 历史基准；Swift 常量已生成，当前无原生直接消费者，不作为生效的 14pt 原生字号。 |
| `sidebar.brandFontSize` | `14` | 原生 pt；MemoCard 品牌文字，按 subheadline 文字大小缩放。 |
| `sidebar.captionFontSize` | `12` | 原生 pt；分组标题、数量、状态与辅助提示，按 caption 文字大小缩放。 |

[NativeSidebar.swift](../apps/apple/Sources/NativeSidebar.swift) 通过 `@ScaledMetric` 解析正文、品牌与辅助字号，再调用 `.system(size:)`。这些数字是默认基准；实际文字继续遵循现有 Dynamic Type 行为，图标、布局与 WebView bridge 保留各自规则。

## 原生文字用法清单

下表来自 [typography-usage.generated.json](typography-usage.generated.json) 的全部原生条目，保留原表达式和源码位置。它用于维护现有实现，不能将扫描到的局部数值解释为新增的通用字号标尺，也不能推定每个条件分支或预览都已运行验收。

- `font` 的 `.caption / .caption2 / .footnote / .headline / .subheadline` 使用系统语义样式；`.system(size: …)` 保留显式尺寸、变量与条件表达式。
- `fontWeight` 保留当前状态对应的字重选择。
- `lineSpacing` 是额外行间距（pt），不等同于 CSS 完整行高。

| Property | Value | 源码位置 |
| --- | --- | --- |
| `font` | `.caption` | [NativeChrome.swift:496](../apps/apple/Sources/NativeChrome.swift#L496) |
| `font` | `.caption2` | [NativeChrome.swift:318](../apps/apple/Sources/NativeChrome.swift#L318) |
| `font` | `.footnote` | [NativeChrome.swift:587](../apps/apple/Sources/NativeChrome.swift#L587) |
| `font` | `.headline` | [NativeChrome.swift:318](../apps/apple/Sources/NativeChrome.swift#L318) |
| `font` | `.subheadline` | [NativeChrome.swift:562](../apps/apple/Sources/NativeChrome.swift#L562) |
| `font` | `.system(size: 10)` | [NativeDesignedPanel.swift:274](../apps/apple/Sources/NativeDesignedPanel.swift#L274) |
| `font` | `.system(size: 12, weight: .medium)` | [NativeDesignedPanel.swift:196](../apps/apple/Sources/NativeDesignedPanel.swift#L196) |
| `font` | `.system(size: 12)` | [NativeDesignedPanel.swift:192](../apps/apple/Sources/NativeDesignedPanel.swift#L192)<br>[NativeDesignedPanel.swift:216](../apps/apple/Sources/NativeDesignedPanel.swift#L216)<br>[NativeDesignedPanel.swift:261](../apps/apple/Sources/NativeDesignedPanel.swift#L261)<br>[NativeDesignedPanel.swift:345](../apps/apple/Sources/NativeDesignedPanel.swift#L345) |
| `font` | `.system(size: 13)` | [NativeDesignedPanel.swift:316](../apps/apple/Sources/NativeDesignedPanel.swift#L316) |
| `font` | `.system(size: 14, weight: .medium)` | [NativeDesignedPanel.swift:199](../apps/apple/Sources/NativeDesignedPanel.swift#L199)<br>[NativeDesignedPanel.swift:307](../apps/apple/Sources/NativeDesignedPanel.swift#L307) |
| `font` | `.system(size: 14)` | [NativeDesignedPanel.swift:191](../apps/apple/Sources/NativeDesignedPanel.swift#L191)<br>[NativeDesignedPanel.swift:210](../apps/apple/Sources/NativeDesignedPanel.swift#L210)<br>[NativeDesignedPanel.swift:214](../apps/apple/Sources/NativeDesignedPanel.swift#L214)<br>[NativeDesignedPanel.swift:275](../apps/apple/Sources/NativeDesignedPanel.swift#L275)<br>[NativeDesignedPanel.swift:342](../apps/apple/Sources/NativeDesignedPanel.swift#L342) |
| `font` | `.system(size: 16)` | [NativeDesignedPanel.swift:242](../apps/apple/Sources/NativeDesignedPanel.swift#L242)<br>[NativeDesignedPanel.swift:245](../apps/apple/Sources/NativeDesignedPanel.swift#L245) |
| `font` | `.system(size: 20)` | [NativeDesignedPanel.swift:283](../apps/apple/Sources/NativeDesignedPanel.swift#L283)<br>[NativeDesignedPanel.swift:287](../apps/apple/Sources/NativeDesignedPanel.swift#L287)<br>[NativeDesignedPanel.swift:297](../apps/apple/Sources/NativeDesignedPanel.swift#L297) |
| `font` | `.system(size: bodyFontSize)` | [NativeSidebar.swift:80](../apps/apple/Sources/NativeSidebar.swift#L80)<br>[NativeSidebar.swift:158](../apps/apple/Sources/NativeSidebar.swift#L158)<br>[NativeSidebar.swift:295](../apps/apple/Sources/NativeSidebar.swift#L295) |
| `font` | `.system(size: brandFontSize, weight: .semibold)` | [NativeSidebar.swift:100](../apps/apple/Sources/NativeSidebar.swift#L100) |
| `font` | `.system(size: captionFontSize, weight: .medium)` | [NativeSidebar.swift:196](../apps/apple/Sources/NativeSidebar.swift#L196) |
| `font` | `.system(size: captionFontSize)` | [NativeSidebar.swift:117](../apps/apple/Sources/NativeSidebar.swift#L117)<br>[NativeSidebar.swift:170](../apps/apple/Sources/NativeSidebar.swift#L170)<br>[NativeSidebar.swift:171](../apps/apple/Sources/NativeSidebar.swift#L171)<br>[NativeSidebar.swift:173](../apps/apple/Sources/NativeSidebar.swift#L173)<br>[NativeSidebar.swift:277](../apps/apple/Sources/NativeSidebar.swift#L277) |
| `font` | `.system(size: size == 44 ? 20 : 16)` | [NativeChrome.swift:475](../apps/apple/Sources/NativeChrome.swift#L475) |
| `font` | `.system(size: visualIconSize)` | [NativeSidebar.swift:273](../apps/apple/Sources/NativeSidebar.swift#L273) |
| `fontWeight` | `item.selected == true ? .medium : .regular` | [NativeSidebar.swift:275](../apps/apple/Sources/NativeSidebar.swift#L275) |
| `lineSpacing` | `6` | [NativeDesignedPanel.swift:242](../apps/apple/Sources/NativeDesignedPanel.swift#L242) |

## 维护与验证

运行 `pnpm typography:build` 更新使用目录，`pnpm typography:check` 检查漂移；原生表达式或位置变化后，同步本页表格。文档回归逐项核对四个字号基准和全部原生用法及来源，定义和完整覆盖清单继续保留。

Typography Docs 只展示通用文字体系。旧 `foundation-typography-notes` 与 `foundation-title-typography-notes` 锚点保留为通用文字样式标题的兼容定位点；原故事 ID 和隐藏诊断测试不变。此文档整理不调整 Swift 字号、字重、行距、ScaledMetric、布局或系统缩放行为，Web 浏览器验证不代替原生真机验收。
