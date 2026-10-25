# 新版 UI 状态 Preview

唯一状态 Preview 入口为 <http://127.0.0.1:5182/>，`dev:states` 与 `dev:states:ui-next` 均启动新版：

```sh
pnpm --filter @memocard/ui dev:states:ui-next
```

首页包含异常状态 45 项、空状态 3 项和吉祥物 13 项。外壳、场景内页面和吉祥物页面使用 UI-next token、Base UI 组件及 Hugeicons。场景复用真实 `App` 控制器，通过 `renderWebApp` 加载新版业务视图和新版编辑器；不维护一份仿制的业务页面。

场景可在下拉框按组选择、前后切换和重置，支持浅色／深色、桌面／375px 内容视口、正常／2 秒延迟读取。URL 保留场景、主题、尺寸及延迟，支持浏览器前后导航。外层空间小于 375px 时，iframe 收缩到可用宽度。吉祥物页保留全部角色、原素材、两项渐隐变体、鼠标跟随以及点击／键盘表情互动。

## 场景和隔离

- `apps/ui/ui-state-fixtures/catalog.ts` 维护共享 48 个场景 ID；新版 `preview/scenarios.ts` 调整新版实际入口、日期格式及操作说明。图片慢速加载直接打开详情，确保显示实际图片组件。
- `ui-state-fixtures/mock.ts` 维护基础故障；`state-fixture.ts` 补充新版页面实际消费的固定与标签偏好及筛选。空笔记库允许新建后回到列表；清除搜索或图片筛选恢复内容；属性保存失败可经重试恢复。每次创建场景都获得独立内存。
- `preview/ScenarioView.tsx` 用真实控制器打开草稿、触发授权取消、搜索／筛选空态和刷新超时。属性／确认场景自动展开真实属性面板；后续操作使用真实组件。
- Vite 在模块加载前替换 `src/bridge`、`src/client-mode`、`src/browser-runtime`；未知操作明确拒绝，不回退到真实文件、服务或原生调用。`/api/` 在开发服务返回 403，页面 CSP 限定本地资源；旧 `src` CSS 通过既有 `uiNextStyleBoundary` 隔离。
- iframe 内的 localStorage、sessionStorage、草稿和设置均为内存数据，重置场景即丢弃。外观存储失败通过拒绝存储写入注入，字体失败通过拒绝实际 `document.fonts.load` 注入。字体场景故意产生带“模拟字体加载失败”的控制台错误；不能把该预期错误当作启动失败。

## 检查命令

```sh
pnpm --filter @memocard/ui typecheck:states:ui-next
pnpm --filter @memocard/ui test:states:ui-next
pnpm --filter @memocard/ui exec vitest run --config vite.storybook-next.config.ts web/workspace-fixture.test.ts --maxWorkers=3
pnpm --filter @memocard/ui exec vitest run ui-state-fixtures/ --exclude 'ui-next/**' --maxWorkers=3
pnpm --filter @memocard/ui exec eslint ui-next/preview ui-state-fixtures mascot-fixtures/catalog.ts vite.preview-next.config.ts
pnpm --filter @memocard/ui build:states:ui-next
```

`preview-next-static` 为独立三入口构建产物，已忽略；不会写入 `dist`、`dist-web-next` 或原生 Web 资源。专项类型检查覆盖新版 Preview 及其真实依赖；清理后在独立 main 基础上同时通过整个 UI-next 与生产 Web 类型检查。工作区其他编辑器改动未纳入本次提交。

## 2026-10-25 本机验证

- 新版真实页面、隔离策略与退役约束共 42 项测试通过；共享 fixture 与生产默认视图回归共 68 项通过。补充的类型确认取消、有损转换拒绝、删除属性确认均使用真实新版弹层验证。新版专项类型检查、修改范围 ESLint、diff 空白检查和三入口静态构建通过。
- 在实际应用内浏览器，45 个异常场景分别完成桌面浅色和 375px 深色的入口加载检查：真实新视图均可见，页面无横向溢出，未渲染 Lucide 图标。该遍历是入口与布局冒烟检查，不等于每个场景的所有操作都逐项人工验收。
- 三个空态均可进入；搜索／图片筛选显示真实无结果，点击“查看所有笔记”恢复列表。外观保存失败保留当次颜色，重载恢复默认；字体失败及重试显示回退提示；图片慢读显示占位后成功加载，超 20 MB 导入错误通过真实菜单触发。
- 首页、吉祥物页在 320px 下无横向溢出；13 个角色逐个点击后反应层可见，Enter 可触发表情，鼠标移动会改变方向层的 sprite 位置。
- 用独立静态服务检查首页、场景 iframe、吉祥物三条路径。初次发现 CSP 与默认内联字体不兼容，已设置 `assetsInlineLimit: 0`；修复后在全新浏览器会话复查三入口，无控制台错误或警告。构建仍保留大 chunk 和共享 HomeMascot 静态／动态导入提示，未将其声明为性能优化。
- 清理后旧版 5178 服务与旧运行入口不再保留；新版开发服务 5182 返回 200，真实 `/api/` 请求返回 403。没有访问真实笔记库，也未执行原生或跨设备同步验收。

本机辅助证据位于 ignored `build/verification/ui-next-preview/`（首页截图与浏览器遍历记录）；这些本机证据不代替远程 CI 或其他设备复验。

## 旧 Preview 清理

旧 `apps/ui/preview` 目录、`vite.preview.config.ts`、5178 开发入口和过时原型页面已删除；`dev:states` 转向新版。共享场景及 mock 回归迁入 `ui-state-fixtures`；仍需验证生产默认视图的回归保留为 `legacy-app-states.test.tsx`，不再提供旧 Preview 页面。组件维护表中的验收路径和 CI 新版构建检查同步更新。

13 个角色实际消费的 22 张 sprite 与许可证留在 `mascot-fixtures`；19 张历史候选转入设计归档。215 份角色创作源文件转入 `design/mascots/characters`，生成脚本和说明路径同步调整；两个旧原型仅保留设计说明。归档入口见[角色创作和原型归档](mascots/README.md)。运行时素材及创作源图片均与迁移前逐字节核对。

此次只删除旧 Preview，生产默认视图和原生 App 仍使用共享 `src/App.tsx`。删除整套旧生产 UI 前仍需处理默认渲染器和组件类型依赖；不能据此删除共享业务核心。此 Preview 不替代真实笔记库、iCloud 双设备同步、iOS 键盘／手势／安全区或原生 App 验收。
