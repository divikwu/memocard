# 组件使用文档

组件描述参考 Astryx 的用途、组成和使用建议；Button 页面进一步对齐 [Astryx Button](https://astryx.atmeta.com/components/Button) 的 Overview、Properties、Accessibility 分页结构。示例参考 [shadcn Button](https://ui.shadcn.com/docs/components/base/button) 的实际预览和使用代码。文档描述 MemoCard 现有契约，保留默认外观、Base UI 包装与 iOS 系统组件。

## 试点入口

| 组件 | Storybook Docs | 生产接口来源 |
| --- | --- | --- |
| Button | `components-button--docs` | `apps/ui/src/components/ui/button.tsx` |
| Input | `components-input--docs` | `apps/ui/src/components/ui/input.tsx` |
| Dialog | `components-dialog--docs` | `apps/ui/src/components/ui/dialog.tsx` |
| Note Search | `business-note-search--docs` | `apps/ui/src/components/note-search-dialog.tsx` |

在 Storybook 地址后添加 `?path=/docs/<入口 ID>`，或从组件侧栏打开 Docs。Input、Dialog、Note Search 的布局由 `apps/ui/.storybook/component-docs.tsx` 维护，组件说明和最小代码随各自 `.stories.tsx` 保存。Button 使用 `apps/ui/stories/button-docs.tsx` 专属文档页，先验证分页结构和交互参数预览，不提前迁移其他组件。组件归属、覆盖状态与验收入口仍在[维护表](component-inventory.md)维护，不新增一份组件注册表。

## Button 分页试点

- **Overview**：六种现有变体的居中总览，随后展示最小用法、八种现有尺寸、组成和使用建议；代码默认收起，可按需展开。总览、尺寸、用法与键盘示例均在 Docs 预览框内水平、垂直居中；Properties 保留参数面板的实际布局，使用 iframe 的单层 16px 留白，避免组件再次叠加内边距。总览和详细示例分别使用实际故事，不重复列出同一个故事。
- **Properties**：在同一个隔离 iframe 内放置真实生产 Button 和带标签的参数控件，修改参数立即更新预览；重置恢复示例初始值。可展开的使用代码与当前参数一致，点击计数仅用于观察示例回调。生产 API 表保留实际类型和默认值，不将示例控制器作为新增组件接口。
- **Accessibility**：说明键盘激活、焦点、禁用和可访问名称，提供原有键盘与禁用故事作为手动验证入口，并保留平台职责说明。分页本身支持键盘选择。

只对齐文档的信息结构和展示方式。Button 继续使用 MemoCard 已有六种变体、八种尺寸及生产样式，不照搬 Astryx 的属性命名、组件外观或额外功能。

## 其他试点页面顺序

1. **用途**：一句话说明组件解决的问题与使用范围。
2. **默认示例与用法**：先显示一个实际可操作的场景，附最小完整使用代码。代码包含真实 import、必要状态和回调，不包含 fixture 安装或测试断言。
3. **组成**：必要子组件、标签和可选区域。
4. **使用建议**：选择、组合与不适用场景；仅列与该组件有关的规则。
5. **变体与状态**：沿用其他 Story；首个示例不重复展示。没有独立变体时不制造新的状态。
6. **API 与组合契约**：说明本地组件增加或改变的接口、必填项与实际默认值。常用继承属性列出必要项，其余链接 DOM 或 Base UI。
7. **交互与无障碍**：键盘、关闭、焦点、可访问名称及错误反馈。
8. **平台差异**：Web、H5 与 iOS 的职责和原生 Preview 入口，说明本页的验证边界。

## API 和示例参数

- Button、Input 的参数表以生产组件源码为准；显式维护常用参数，避免自动推导遗漏组合类型。列表不宣称覆盖全部继承 DOM 属性。
- Dialog、Note Search 的生产接口通过组合契约或生产参数表说明；Storybook 包装器的参数单列为“示例控制项”。`onSave`、`initialOpen` 等示例接口不作为生产组件接口发布。
- Controls 只开放对当前故事真实生效的参数。初始化值、内部受控值和回调仍可列在文档中，但不提供会误导使用者的控件。
- 示例回调与内存数据只说明交互结果，不能表述为真实保存、真实笔记库读取或原生验收。
- 修改生产接口时，在同一改动中更新该组件的说明、参数表、使用代码与相关 Story；复用上游接口链接，避免抄录整份第三方 API。

## 展示和验证

Docs 复用现有隔离 iframe，不自动执行 `play`，开发者可手动操作；Canvas 和 Vitest 继续执行完整交互检查。Button 的参数控件在故事内部维护临时状态，无需共享 Docs 页面状态或跨 iframe 同步。Properties 单独启用 `docs.story.autoHeight`，按同源内容根尺寸调整 iframe 高度，适应窄布局与代码展开；切页时清理观察器，其他故事继续使用原有固定高度。默认示例与其他状态分开展示，业务故事保留实际桌面/H5 视口及原有数据隔离。

执行 `pnpm verify:design` 验证类型、静态构建、故事交互与设计维护门禁，再在真实 Docs 检查：说明与代码可按需查看、首故事只展示一次、参数表准确、示例手动交互与回调有效。Button 额外检查三个分页、六变体总览、八尺寸展示、参数修改和重置、键盘与禁用行为，以及代码初始收起。对照检查未迁移的 Docs，确认其内容与隔离行为保持。

本次文档试点不改变生产样式、token、组件实现、原生组件或交互协议。可见验收、自动回归和 CI 结果分别记录在[验证记录](validation.md)中。
