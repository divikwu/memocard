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

- **Overview**：六种现有变体总览 → 用法 → 组成 → 使用建议 → 示例。示例展示八种现有尺寸、图文按钮、禁用状态和通过 `render` 组合的真实链接。独立按钮预览居中，代码默认收起；每个故事在对应区域展示一次，不新增按钮 API。
- **Properties**：同一个隔离 iframe 内放置真实生产 Button 和一组参数行。每行列出名称、类型、默认值、说明与可操作控件；`onClick` / `render` 只读。CSF 与参数行共同消费 `apps/ui/stories/button-docs.data.ts`，避免另列重复的 API 表。参数预览使用 iframe 的单层 16px 留白，组件不叠加内边距。点击计数仅用于观察示例回调，图标与文字编辑限制明确标为预览策略。
- **Accessibility**：按键盘与焦点、可访问名称、禁用/链接语义及颜色状态列出说明，链接真实 Foundations 诊断与验证记录；保留已知颜色对比度缺口，不将键盘回归当作整页或所有配色的 AA 证明。继续提供原有键盘与禁用故事及平台职责说明。

所有 Button 文档示例与实时参数预览共用 `button-code-panel.tsx`：默认收起，展开后显示 TSX 高亮与复制按钮。静态示例提供完整生产使用代码，动态代码与当前参数保持一致。Storybook 的代码主题 Provider 仅包裹代码高亮区域，生产组件继续使用原来的主题 Provider。

Properties 面板在当前 Docs 会话中保留挂载，切到其他页签再返回时保留参数、点击反馈和代码开合状态；隐藏面板仍退出键盘与无障碍导航。Reset 重置参数和计数，页面刷新重新开始会话；不使用真实 localStorage 持久化演示状态。

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

Docs 复用现有隔离 iframe，不自动执行 `play`，开发者可手动操作；Canvas 和 Vitest 继续执行完整交互检查。Button 的参数控件在故事内部维护临时状态，无需跨 iframe 同步。需要适应内容的故事显式启用 `docs.story.autoHeight`，按同源自然内容根尺寸调整 iframe 高度；Properties 隐藏后再显示也应恢复内容高度，文档卸载时清理观察器，其他故事继续使用既有固定高度。业务故事保留实际桌面/H5 视口及原有数据隔离。

执行 `pnpm verify:design` 验证类型、静态构建、故事交互与设计维护门禁，再在真实 Docs 检查：说明与代码可按需查看、首故事只展示一次、参数表准确、示例手动交互与回调有效。Button 额外检查一组参数行、跨页签保留参数及同一 iframe、隐藏面板语义、代码初始收起/高亮/真实复制读回、Reset、图文/禁用/真实链接，以及内容展开和窄布局下的高度与溢出。自动测试的 clipboard spy 仅证明调用；不能代替真实浏览器复制读回。对照检查未迁移的 Docs，确认其内容与隔离行为保持。

本次文档试点不改变生产样式、token、组件实现、原生组件或交互协议。可见验收、自动回归和 CI 结果分别记录在[验证记录](validation.md)中。
