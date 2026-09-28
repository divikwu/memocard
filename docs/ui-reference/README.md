# UI 模板源码基线

参考页面：https://ui.shadcn.com/view/new-york-v4/sidebar-10

本目录保存 2026-09-28 从 shadcn 官方 registry 获取的源码；manifest.json 记录文件摘要与来源，LICENSE.md 保存上游 MIT 许可。

- sidebar-10.json：页面布局、导航及页面操作的组合基线。
- sidebar.json：Sidebar 各组件原始结构与 Tailwind 类。MemoCard 用 Base UI useRender/mergeProps 适配多态按钮，保留受控展开状态、移动抽屉焦点、输入框快捷键隔离与关闭后的 inert。
- button/card/input.json：原始样式和组件结构；Button、Input 保留 Base UI 实现。
- dialog/dropdown-menu/select.json：表面、间距和尺寸基线；交互仍由 Base UI 负责。

AppSidebar 将团队切换器映射为真实笔记库操作，主要导航映射为搜索、新建、所有笔记、草稿，收藏区映射为标签。NavActions 仅包含已经实现的操作。模板占位块改为真实笔记；设置与编辑器为功能适配页，不声称是模板自带页面。

桌面保留 256px 侧栏、56px 顶栏、32px 菜单行和 768px 内容区；移动端保留 288px 抽屉与 44px 触控区。外观选项继续兼容原有设备偏好。

components.json 的 new-york 表示视觉基线。官方生成器可能生成 Radix 组件，后续导入时须审查并适配现有 Base UI API，不应直接覆盖运行中的组件。
