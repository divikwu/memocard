# 侧栏规格

当前 Web 侧栏由 [sidebar.tsx](../../apps/ui/ui/business/sidebar.tsx)、[标签导航](../../apps/ui/ui/business/tag-navigation.tsx)、[树行](../../apps/ui/ui/business/sidebar-tree-item.tsx)和[sidebar.css](../../apps/ui/ui/business/sidebar.css)维护。iOS 使用 [NativeSidebar](../../apps/apple/Sources/NativeSidebar.swift) 与 UIKit 推移容器，两端共享业务含义而保留平台度量。

## 当前度量

| 项目 | 桌面 Web / macOS | H5 | iOS 自定义侧栏 |
| --- | --- | --- | --- |
| 行最小高度 | 36px 基准，允许按行盒增长 | 44px 基准，允许按行盒增长 | 48pt 基准，随 Dynamic Type 增长 |
| 图标视觉框 | 16px | 16px | 16pt 基准，随文字缩放 |
| 文字 | 14px 基准，Noto Sans | 沿用当前 14px 行文字 | 系统 16pt 正文基准 |
| Logo | 36px | 36px | 28pt |
| 图文间距 | 8px 基准 | 8px 基准 | 8pt 基准 |
| 标签缩进 | 组件管理 margin / border / padding | 组件管理触摸层级留白 | 每级 24pt 基准 |
| 圆角 | 当前侧栏行使用 full 胶囊角色 | 同一胶囊角色 | 从实际主题 `rowRadius` 接收 |

Web 行高公式为 `max(--ui-sidebar-row-min, 1lh + --spacing-1 × 3)`；桌面最小值引用 `--size-element-md`，H5 引用 `--size-element-lg + --spacing-1`。不要把原生尺寸 JSON 的 32/48 基准当作当前 Web 消费。

H5 展开控件视觉框 40px，伪元素扩展到 44px 命中区；原生沿用 40pt 视觉框与 44pt 命中区。图标视觉框、按钮命中目标和整行高度独立，系统控件遵循平台规则。导航断点为 768px。

## 状态与行为

行点击执行导航/筛选，独立展开按钮只展开/收起。三级标签使用完整路径导航，保留 Emoji、置顶顺序、搜索和切库重置；日历等未实现入口继续禁用。桌面保留悬停替换、键盘焦点、菜单 Escape 与回焦；H5 操作从顶部标题菜单进入。

iOS 保留边缘展开、主页面推移、侧滑/点击关闭和系统安全区；原生底部搜索与捕获、设置/笔记库及草稿动作经共享控制器投影。文字放大允许内容增长，VoiceOver 获得完整路径。

当前 Storybook 为 [business/sidebar](../../apps/ui/ui/stories/business-sidebar.stories.tsx) 与[基础 sidebar](../../apps/ui/ui/stories/luma-sidebar.stories.tsx)，默认/选中/禁用/展开/长名/层级/加载等场景使用生产实现。Debug 原生 palette 和默认圆角由当前 CSS 采样，不拥有另一套主题。

## Web 界面主题

Web 设置的「界面主题」提供默认「经典」侧栏与「简约」顶部栏；「颜色模式」独立控制浅色、深色或跟随系统。选择保存在当前浏览器，旧偏好默认经典。简约仅作用于宽度至少 768px 的 Web；窄屏仍使用抽屉，原生端不提供该选项。切换主题不重建编辑器或重置路由、筛选和撤销记录。

[WebTopNavigation](../../apps/ui/ui/web/WebTopNavigation.tsx) 的标签弹层复用 TagNavigation 与 SidebarTreeItem，保留层级、置顶、图标和标签操作；外层间距与更多菜单对齐。更多集中设置、回收站、草稿、快捷筛选及笔记库操作，保留忙碌和权限限制。新建笔记使用主页捕获、列表工具栏或移动端入口。

简约导航、集合与详情白色外层最大宽度同为 80rem；768–1023px 两侧各留 24px，1024px 起各留 32px。详情正文继续遵循内容行宽。Web 首页列表随内容收尾，所有笔记列表继续撑满可用高度。

当前主题按“视觉主题＋可复用布局”组合；[共享导航模型](../../apps/ui/ui/business/navigation-model.ts)统一动作与可用性，[WorkspaceFrame](../../apps/ui/ui/web/WorkspaceFrame.tsx)保持内容树稳定，[组合目录](../../apps/ui/ui/web/appearance/catalog.ts)按需加载布局与视觉资源。主页面和浮层共享 ThemeScope，富文本内核经工厂注入 Portal。新增视觉主题只需 CSS/参数与布局引用；详见[Web 界面主题架构](../../docs/WEB_INTERFACE_THEMES_ARCHITECTURE.md)。仍使用 v1 偏好，未知主题 ID 保留并回退到可用界面。

## 验证与性能

执行 `pnpm verify:design`、`pnpm test:sidebar-native`、`pnpm test:native-surfaces` 和相关产品回归。真实浏览器检查宽窄屏、焦点、触摸关闭和主题；Xcode Preview、Simulator probe 与完整 App 手势分开记录，不能互相替代。

当前 Web 基准命令为 `pnpm bench:sidebar:web`，默认比较已发布 MemoCard UI 起点 `de51cec` 与工作树的 TagNavigation 模块，统一共享 helpers、展示层/存储 mock 和 SSR 冷挂载测量。它不是完整历史 App、DOM 布局、动画、FPS 或真机性能。历史算法及原生测量与复跑边界见[性能记录](../performance.md)。
