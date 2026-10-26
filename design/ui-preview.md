# 整页状态与吉祥物 Preview

当前状态 Preview 入口为 <http://127.0.0.1:5182/>；唯一产品入口仍是 [src/main.tsx](../apps/ui/src/main.tsx)，产品、Storybook 与 Preview 共用 Luma 主题及生产业务视图。现行源码、配置与示例统一使用 `ui` 命名。

```sh
pnpm --filter @memocard/ui dev:states
```

首页包含异常、空状态与吉祥物目录；实际数量和场景 ID 以 [catalog.ts](../apps/ui/ui-state-fixtures/catalog.ts) 与[角色目录](../apps/ui/mascot-fixtures/catalog.ts)为准。

## 真实视图与隔离

[ScenarioView](../apps/ui/ui/preview/ScenarioView.tsx) 驱动共享 App 控制器，使用当前页面、编辑器、属性、搜索和确认组件。场景与操作说明位于 [scenarios.ts](../apps/ui/ui/preview/scenarios.ts)，基础故障位于 [mock.ts](../apps/ui/ui-state-fixtures/mock.ts)，页面状态补充位于 [state-fixture.ts](../apps/ui/ui-state-fixtures/state-fixture.ts)。

场景可按组选择、前后切换和重置，支持浅/深色、桌面/375px 内容视口和读取延迟。URL 保留选择并支持浏览器前后导航；容器更窄时 iframe 收缩。吉祥物页使用实际 sprite、指针跟随、点击和键盘反应。

[Vite Preview 配置](../apps/ui/vite.preview.config.ts) 在加载前替换共享 bridge、client-mode 和 browser-runtime；未知操作明确失败，`/api/` 返回 403，不能回落用户文件、原生调用或本机服务。存储、草稿和设置都在该场景内隔离，重置即丢弃；生产不需要旧样式隔离插件。

字体/外观故障通过显式 fixture 注入；预期的“模拟字体加载失败”错误须与意外 console error 区分。Preview 不进入生产依赖图，也不改变生产外观偏好。

## 检查命令

```sh
pnpm --filter @memocard/ui typecheck:states
pnpm --filter @memocard/ui test:states
pnpm --filter @memocard/ui build:states
pnpm verify:ui
```

静态输出为 `apps/ui/preview-static`，包含首页、场景 iframe 与吉祥物三入口，与产品 `apps/ui/dist`、Storybook 输出和 Apple Web 资源分离。共享场景控制器回归现位于 [app-controller-states.test.tsx](../apps/ui/ui-state-fixtures/app-controller-states.test.tsx)。

## 验收边界

入口遍历和无溢出检查只证明所测视口可加载，不证明每个场景的全部交互已人工验收。隔离内存保存不能代替真实 vault、系统 picker、iCloud、IME、键盘、手势或安全区验收；原生 Preview 与 surface probe 是另一个验收面。

当前产品迁移与完整验证记录见[旧 UI 清理记录](ui-retirement-2026-10-25.md)。下列结果保留为当时 Preview 迁移证据，不代表当前完整回归计数。

## 历史验收：2026-10-25 Preview 迁移批次

- 新版真实页面、隔离策略与退役约束共 42 项测试通过；共享 fixture 与生产默认视图回归共 68 项通过。补充的类型确认取消、有损转换拒绝、删除属性确认均使用真实新版弹层验证。新版专项类型检查、修改范围 ESLint、diff 空白检查和三入口静态构建通过。
- 在实际应用内浏览器，45 个异常场景分别完成桌面浅色和 375px 深色的入口加载检查：真实新视图均可见，页面无横向溢出，未渲染 Lucide 图标。该遍历是入口与布局冒烟检查，不等于每个场景的所有操作都逐项人工验收。
- 三个空态均可进入；搜索／图片筛选显示真实无结果，点击“查看所有笔记”恢复列表。外观保存失败保留当次颜色，重载恢复默认；字体失败及重试显示回退提示；图片慢读显示占位后成功加载，超 20 MB 导入错误通过真实菜单触发。
- 首页、吉祥物页在 320px 下无横向溢出；13 个角色逐个点击后反应层可见，Enter 可触发表情，鼠标移动会改变方向层的 sprite 位置。
- 用独立静态服务检查首页、场景 iframe、吉祥物三条路径。初次发现 CSP 与默认内联字体不兼容，已设置 `assetsInlineLimit: 0`；修复后在全新浏览器会话复查三入口，无控制台错误或警告。构建仍保留大 chunk 和共享 HomeMascot 静态／动态导入提示，未将其声明为性能优化。
- 清理后旧版 5178 服务与旧运行入口不再保留；新版开发服务 5182 返回 200，真实 `/api/` 请求返回 403。没有访问真实笔记库，也未执行原生或跨设备同步验收。

本机辅助证据位于 ignored `build/verification/ui-next-preview/`（首页截图与浏览器遍历记录）；这些本机证据不代替远程 CI 或其他设备复验。

## 历史素材与入口

旧状态预览和原型已退役，现有组件与共享状态 fixture 均使用本页入口。角色创作源和未采用候选保存在[素材归档](mascots/README.md)，运行时素材目录只保留实际消费的 sprite 和许可。历史截图、端口和旧文件名不再是当前维护接口。
