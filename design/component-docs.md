# 组件文档维护

唯一 Storybook 使用当前生产组件、Luma 主题和 Base UI。配置为 [main.ts](../apps/ui/.storybook-next/main.ts)，故事位于 `apps/ui/ui-next/stories`。启动 `pnpm --filter @memocard/ui storybook`，访问 <http://127.0.0.1:6016/>。

## 源码与入口

| 内容 | 当前实现 | Storybook |
| --- | --- | --- |
| 基础控件 | `apps/ui/ui-next/components` | `components/*` |
| 业务视图 | `apps/ui/ui-next/business` | `business/*` |
| 完整页面 | [WebAppView](../apps/ui/ui-next/web/WebAppView.tsx) 与共享 [App](../apps/ui/src/App.tsx) | `pages/Web & H5` |
| 主题与基础规范 | [TokenPage](../apps/ui/ui-next/TokenPage.tsx)、[主题目录](../apps/ui/ui-next/token-catalog.ts) | `foundations/*` |
| 文档模板 | [ComponentDocsTemplate](../apps/ui/ui-next/ComponentDocsTemplate.tsx)、[组件说明](../apps/ui/ui-next/ComponentDocs.tsx) | `ui-next-component-docs-template` 的 Docs |

维护路径和覆盖边界以[组件维护表](component-inventory.md)为准。只有 `ui-next` 这一套当前实现；保留的兼容命令不会启动另一套产品。

## 编写规则

组件 Docs 使用共享模板的 Overview / Properties / Accessibility 分区，包含真实示例、用法代码、属性与推荐/避免说明。示例通过 `ComponentDocsExample` 连接 Canvas；代码与生产 API 一致，复制行为由 `ComponentDocsSource` 处理。业务组合场景按需提供完整交互故事，不为内部适配器复制一份实现。

样式读取当前主题、字体和圆角。Portal、示例根和 Docs 容器必须继承同一明暗模式，不能在说明页重新定义产品 token。切换页签或外观时保留当前输入；保持可访问名称、键盘焦点、代码滚动和窄屏边界。

故事调用生产组件和共享控制器。数据桥由 [test-support/bridge.ts](../apps/ui/test-support/bridge.ts) 隔离，未知操作与资产请求明确失败；每个故事重置 handler、临时存储和内存资产。页面 fixture 不可回落真实笔记库或本机服务，也不能成为产品依赖。

## 检查与验收

```sh
pnpm --filter @memocard/ui typecheck:storybook
pnpm --filter @memocard/ui build:storybook
pnpm --filter @memocard/ui test:storybook
pnpm verify:design
```

静态输出只有 `apps/ui/storybook-next-static`。浏览器项目由 [vitest.storybook.config.ts](../apps/ui/vitest.storybook.config.ts) 定义：`storybook-desktop`、`storybook-mobile` 和 `ui-quality`。桌面故事采用 1024×900，移动故事采用 390×844；质量检查涵盖窄屏、文字放大、减少动态和字体失败。以配置和实际日志为准，不保留已经删除的专用测试项目命令。

Storybook、状态 Preview、生产浏览器流程和原生 Simulator 分开报告。内存写入不证明真实 vault 写入，浏览器测试不代替 WKWebView、系统 picker、IME、键盘、安全区或真机验收。历史模板迁移和旧页签测试记录只作为演进证据，现行维护从本页入口开始。
