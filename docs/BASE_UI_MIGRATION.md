# Base UI 系统迁移验收

日期：2026-10-09。目标：将全部运行中的 Radix primitives 替换为 Base UI，清除直接/传递依赖及生产资源中的 Radix，保留既有业务交互，并修正内容块子菜单顶部对齐。

最新尺寸决定：按后续确认，内容块主菜单与子菜单行高已恢复为 36px，与默认按钮、输入框一致；内边距仍为 4px。下文 32px 为此前验收时的历史尺寸。

发布前复查（2026-10-10）：`pnpm audit --prod` 无已知漏洞，`pnpm verify:release` 全部通过，包含 383 项 UI 测试、本机服务测试、macOS/iOS/服务构建及签名校验。下文阴影阶段的非全绿记录是历史结果，不代表当前回归状态。最新入口精简与章节折叠见 [EDITOR_SECTION_FOLDING.md](EDITOR_SECTION_FOLDING.md)。

## 实现范围

- 使用 `@base-ui/react@1.9.0`；删除 `radix-ui`、`@radix-ui/react-menu` 及其不再需要的传递依赖。锁文件包集合仅新增 Base UI React、Base UI Utils、reselect，未升级其他库。
- 统一迁移 Dialog、Sheet、Popover、Tooltip、Menu、Select、Tabs、Switch、Collapsible、Separator，以及 Button、Badge、Breadcrumb、Sidebar 的组合能力；两个编辑器和全部业务调用点同步迁移。
- 直接使用 Base UI 的 `render/useRender`、`Portal/Positioner/Popup`、`initialFocus/finalFocus` 和状态属性；不保留 Slot、`asChild` 或旧浮层 API 兼容层。Tabs 保持方向键自动激活的原有行为。
- shadcn 生成配置改为 `base-nova`；`shadcn info` 确认为 `base: base`。`docs/ui-reference` 中上游原始快照及许可仅用于视觉溯源，不参与构建、不是组件生成输入。历史文档中的 Radix 描述不是当前实现。
- 按 React best-practices 的按需加载原则，延迟加载标签编辑器、侧栏可选 Tooltip、设置中的 Switch，维持既有包体积预算，不放宽限制。

## 菜单几何与响应式

主菜单与转换子菜单共用 `.rich-block-menu`：四边内边距 4px，单行菜单项 32px。子菜单原本以“转换为”触发项定位，而触发项位于父面板边框与内边距之后；现在在 Base UI Positioner 使用 `alignOffset={-5}`，抵消 1px 边框 + 4px 内边距，使两个面板的顶部一致，而非强行设置相同总高度。

沿用现有 768px 移动断点与窄屏子菜单重叠策略；没有按截图尺寸新增断点。空间不足时仍保留 Base UI 的边界避让。

真实授权服务 `http://127.0.0.1:56903` 实测：

| 视口 | 主菜单 top | 子菜单 top | 内边距 | 单行高度 |
| --- | --- | --- | --- | --- |
| 1490 × 1243 | 248px | 248px | 4px | 32px |
| 390 × 844 | 192px | 192px | 4px | 32px |

截图：[桌面](memocard-base-ui-menus.jpg)、[窄屏](memocard-base-ui-mobile.jpg)。测量针对正常可用空间；靠近视口边缘时允许碰撞处理调整位置。

## 验证与防回退

- `pnpm verify` 退出码 0：类型检查、lint、生产构建及包体积检查全部通过；439 项测试通过（UI 371、MCP 16、Swift 35、原生网络 8、本机 Web 9）。UI 新增 7 项覆盖组合事件与 ref、弹层焦点、Select 键盘、Switch、Tabs、Collapsible，以及嵌套属性弹层 Escape 后焦点恢复。
- 测试 worker 上限设为 4，避免大量并行 jsdom 转译争用导致异步组件导入超时；未提高断言超时或跳过测试。
- `pnpm check:ui-primitives` 已接入 `verify`：检查活动源码、依赖清单、锁文件无 Radix，且生成配置为 Base UI。
- `pnpm check:bundle` 同时检查所有生产 JS/CSS chunk 中无 Radix。完整依赖树检查亦无 Radix。
- 现有初始 gzip 210KiB、JS 600KiB、CSS 85KiB、字体 1MiB 预算均保留；最终初始 gzip 214,703 / 215,040 bytes，字体 908,432 bytes。gzip 余量仅 337 bytes，后续新增组件须继续遵守按需加载与预算门禁。
- `pnpm build:service` 成功；已更新安装的 MemoCardService Web 资源，并刷新真实授权服务页面验证。旧安装包备份在 `/tmp/memocard-base-ui-backup.UyxMwD/MemoCardService.app`，未停止服务进程、未更改真实笔记内容。
- 真实浏览器验证主/子菜单方向键、Escape 与编辑器焦点恢复、属性弹层关闭焦点、页面菜单、主题 Select、标签编辑弹层、Emoji 键盘 Tooltip，以及移动导航抽屉。控制台未发现 warn/error。

验收日志：`/tmp/memocard-base-verify-final.log`、`/tmp/memocard-base-service-final.log`。现有 LiveMarkdownEditor `clearDragPreview` Hook 依赖 lint 警告保留，0 errors。

边界：本轮未手动执行原生中文 IME 候选确认、长时间拖拽边缘滚动、触摸手势或 iPhone 真机；未将浏览器回归表述为这些表面的完整验收。没有提交、推送或合并代码。既有无关工作区改动保留。

## 复查后的优化

同日复查发现并修复 3 处迁移后问题：

- 格式 Popover 关闭并打开属性 Dialog 时，鼠标路径的默认 `finalFocus` 会将焦点抢回后台菜单。仅在转入属性 Dialog 时设置 `finalFocus={false}`；单独 Escape 关闭 Popover 仍使用默认焦点恢复。
- 为块级、文字级格式 Popover 分别添加“块属性与更多操作”“更多格式”可访问名称。
- Switch 默认根元素不匹配原生 `:disabled`，禁用样式改用 Base UI 的 `data-disabled` 状态属性；未改变组件结构或交互。

按无障碍检查与 React 检查清单处理焦点交接和状态属性，未引入额外依赖、计时器或兼容层。先补回归测试复现 4 项失败，修复后相关 86 项全部通过。最新 `pnpm verify` 退出码 0，442 项测试通过（UI 374、MCP 16、Swift 35、原生网络 8、本机 Web 9）；Radix 源码/依赖/锁文件/生产包门禁继续通过。包体积预算未放宽：初始 gzip 214,713 / 215,040 bytes，剩余 327 bytes；字体 908,432 bytes。既有 Hook lint 警告仍保留。

最新服务构建、安装和签名检查成功；安装的 69 个 Web 文件与本次 `dist` 逐字节一致。替换前的安装包与 CLI 可从 `/tmp/memocard-base-polish-backup.LW694v` 恢复，服务进程未停止。真实授权页面已刷新，用鼠标打开“编辑链接”后焦点稳定在弹窗内，Tab/Shift+Tab 正常，Escape 返回编辑器；独立关闭格式 Popover 则回到菜单触发项。测试与实测均未应用属性或修改验收笔记。浏览器控制台无 warn/error。

桌面复测主菜单/转换子菜单 top 均为 248px，四边内边距仍为 4px，全部菜单项仍为 32px；本轮未改变断点与定位策略。Switch 禁用状态验证覆盖组件状态属性、样式类和生产 CSS，未将其表述为真实设置页的可见验收。

焦点修复截图：[编辑链接](memocard-base-ui-focus-fixed.jpg)。本轮日志：`/tmp/memocard-base-polish-red.log`、`/tmp/memocard-base-polish-green.log`、`/tmp/memocard-base-polish-verify.log`、`/tmp/memocard-base-polish-service.log`。上文原生 IME、触摸与真机验收边界仍适用；本轮未重复执行 macOS/iOS 应用构建。

## 恢复默认 36px 行高

仅将 `.rich-block-menu [role="menuitem"]` 的 `min-height` 从 32px 恢复到 36px，未修改默认已为 36px 的 Button/Input，也未改变显式小号控件、4px 面板内边距、断点或顶部定位补偿。

编辑器测试首次运行有 1 项鼠标焦点测试找不到属性对话框；该项单独复查 2 项通过、整组复跑 79 项全部通过，未改测试或放宽超时。服务构建/安装/签名与 Radix 门禁通过，原包体积预算通过。真实授权页面刷新后，主菜单全部 7 行与转换子菜单全部 12 行均实测 36px，四边内边距均 4px；本次锚定正文末尾段落，两个面板 top 均为 445.5px，顶部继续对齐。浏览器控制台无 warn/error。

截图：[36px 菜单](memocard-menu-36px-restored.jpg)。日志：`/tmp/memocard-menu-36-tests.log`、`/tmp/memocard-menu-36-focus-recheck.log`、`/tmp/memocard-menu-36-tests-recheck.log`、`/tmp/memocard-menu-36-build.log`、`/tmp/memocard-menu-36-budget.log`。安装前备份位于 `/tmp/memocard-menu-36-backup.PBp7dj`；未停止服务进程。

## 插入菜单与操作菜单统一细节

两类菜单共用面板和菜单项 CSS 规则：面板圆角 16px、`shadow-md`、14px/1.5 字体；菜单项圆角 10px、最小行高 36px、上下/左右 padding 5px/10px、图文间距 10px。插入列表边距统一为 4px，图标使用相同的 muted 颜色，激活状态使用相同的 accent 主题变量，删除了插入菜单独有的深色状态覆盖。按 baseline-ui 复用已有视觉与主题规则，未改变 Base UI 交互。

保留插入菜单的分组、搜索、底部关闭栏和原有宽度/可用高度/内部滚动约束，不新增断点。搜索栏与关闭栏左右 padding 为 14px，对齐列表 4px + 菜单项 10px 的内容起点；关闭栏实测行高 36px。

编辑器 79 项测试通过，服务构建/安装/签名、Radix 残留门禁和原包体积预算均通过；初始 gzip 214,715 / 215,040 bytes。真实授权页面已刷新：插入菜单 13 行均实测 36px，面板/菜单项圆角、间距、行内 padding、图标颜色和阴影与操作菜单相同。方向键可改变插入菜单当前项。本轮未改变笔记内容；未新增窄屏或真机手动验收证据。

截图：[统一后的插入菜单](memocard-insert-menu-unified.jpg)。日志：`/tmp/memocard-menu-unify-tests.log`、`/tmp/memocard-menu-unify-build.log`、`/tmp/memocard-menu-unify-budget.log`、`/tmp/memocard-menu-unify-primitives.log`。安装前备份在 `/tmp/memocard-menu-unify-backup.GQL28g`，未停止服务进程。

## 弹层阴影优化

新增专用 `--overlay-shadow` token，由 Tailwind `shadow-overlay` 与编辑器 CSS 共用；不修改通用 `shadow-sm/md/lg`。浅色数值来自当前 Notion 弹层的实测计算样式：`0 20px 24px 0 rgb(25 25 25 / 5%), 0 5px 8px 0 rgb(25 25 25 / 2.7%), 0 0 0 1px rgb(42 28 0 / 7%)`。深色采用相同几何，黑色投影透明度为 24%/16%，白色外缘为 10%；深色值是本项目适配，不是 Notion 深色实测值。

覆盖内容块主/子菜单、插入菜单、格式浮层、公式面板、文字工具条、标签建议、通用 Dropdown Menu/Popover/Select/Dialog；标签编辑器移除局部 `shadow-md` 覆盖。保留 1px 透明边框占位，由第三层阴影绘制外缘，避免双重描边且不影响 DOM 尺寸和定位。卡片、输入框、Tooltip、贴边 Sheet 保持原样。按 baseline-ui 与 React 检查清单处理主题样式，未新增动画、依赖或改变焦点逻辑。

服务构建/安装/签名、Radix 残留门禁和包体积预算通过：初始 gzip 214,706 / 215,040 bytes，字体 908,432 bytes。真实授权页面已刷新；主、子菜单计算阴影均为上述浅色三层，top 均为 445.5px、圆角仍为 16px、行高均为 36px。截图：[弹层阴影](memocard-overlay-shadow.jpg)。本轮未手动验收深色或真机。

测试边界：UI 回归未全绿。首次 373/374 通过，失败于 App 的新草稿/深链接加载测试，该测试单独复查通过；第二轮 373/374 通过，失败于 Select 键盘选择测试；单 worker 最后一轮 373/374 通过，失败于鼠标打开属性 Dialog 的焦点测试。没有跳过测试、放宽断言或修改交互以掩盖失败，本次结果不能表述为完整回归通过。

日志：`/tmp/memocard-overlay-shadow-tests.log`、`/tmp/memocard-overlay-shadow-isolated.log`、`/tmp/memocard-overlay-shadow-recheck.log`、`/tmp/memocard-overlay-shadow-serial.log`、`/tmp/memocard-overlay-shadow-build.log`、`/tmp/memocard-overlay-shadow-budget.log`、`/tmp/memocard-overlay-shadow-primitives.log`。安装前备份在 `/tmp/memocard-overlay-shadow-backup.Y7JIhR`，服务进程未停止。
