# UI 模板源码基线

> 历史范围（2026-10-25 标记）：本页保留2026-09-28 至 10-09 的上游快照与旧实现映射，旧端口、源码路径、默认外观及主题 API 不再作为现行维护契约。当前规则见[现行规范](../../design/README.md)。被删除的源文件可用 `git show 6214317:<仓库相对路径>` 查看迁移前快照；本机 ignored 证据路径不保证在新克隆中存在。


唯一基线：[官方 new-york-v4/sidebar-10](https://ui.shadcn.com/view/new-york-v4/sidebar-10)。

2026-09-28 的原始快照保持不变；2026-09-29 从同一个 new-york-v4 registry 补齐 Sheet、Popover、Tooltip、Breadcrumb、Collapsible、Separator、Skeleton、Textarea、Badge、Switch、Alert、Tabs。manifest.json 保存来源与 SHA-256，LICENSE.md 保存上游许可。

## 实现

此目录保留上游原始快照及许可，供视觉溯源，不参与构建，也不能直接覆盖当前组件。2026-10-09 已将 `apps/ui/src/components/ui` 和编辑器浮层统一迁移到 Base UI；使用原生 `render`、`Positioner/Popup`、`initialFocus/finalFocus` API，源码、依赖和产物均不再使用 Radix。生成配置为 `base-nova`。Sidebar 保留受控移动状态、跨断点关闭、输入时不拦截编辑快捷键、关闭侧栏 inert、中文无障碍文案及选中项 aria-current。当前迁移与验收见 [BASE_UI_MIGRATION.md](../BASE_UI_MIGRATION.md)。

AppSidebar 将官方团队菜单映射为笔记库、主要导航映射为笔记/搜索/草稿、收藏与工作区映射为置顶标签与多级标签。Header 使用 SidebarTrigger、Separator、Breadcrumb 和 NavActions。内容保留官方 768px 最大宽度、40px 上下留白及 muted/50 内容块。设置使用 Card/Select/Switch，编辑器使用 Dialog/Input/Button，Markdown 内核与草稿序列化不变。

标签编辑使用 Popover；移动端向下排列、碰撞避让并按可用高度滚动。Emoji 面板使用 Input、Select 和 Button，中文数据来自 emoji-picker-react 4.22.3 的 MIT 数据快照（许可见 emoji-data-LICENSE）；不再加载该包的 UI 或覆盖其 CSS。

默认外观为官方 neutral/mono、Geist、10px 基准圆角。保留用户已经保存的字体、强调色、圆角和深浅色偏好，点击“恢复默认”可回到基线。

官方 sidebar-10 没有笔记编辑器、标签编辑器或设置业务页，这些页面以同一套基础组件组合实现，不声称是官方模板自带页面。

## 验收入口

- 正常应用：`http://127.0.0.1:5179/`
- 开发验收：`http://127.0.0.1:5179/tests/ui-preview.html`（明确标识模拟数据，桥接只操作内存，不访问用户文件；不进入 Vite 生产构建）
- 详细结果：`UI_REBUILD_ACCEPTANCE.md`
