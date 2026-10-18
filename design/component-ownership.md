# 组件归属

| 表面 | 实现 | 共享内容 | 平台拥有的内容 | 预览与验证 |
| --- | --- | --- | --- | --- |
| 桌面 Web / 本机 Web / macOS 侧栏 | React + Base UI / shadcn | token、图标、导航与状态语义 | DOM、键盘、焦点、悬停、密度与响应式 | Storybook、原有业务预览、macOS App |
| H5 侧栏 | 同一组 Web 组件与触摸样式 | 同上 | Sheet、触摸布局与关闭、safe area | Storybook 窄屏、浏览器流程 |
| iOS 自定义侧栏 | SwiftUI + UIKit 推移容器 | 尺寸基准、Lucide、palette、rowRadius、action ID | 系统字体缩放、命中区、safe area、系统边距、推移与手势 | Xcode Preview、iPhone / iPad 模拟器 |
| iOS 工具栏、系统菜单、确认框、文件选择 | SwiftUI / UIKit 系统组件 | 操作含义、文案、危险与禁用状态 | 系统度量、材质、内部布局、SF Symbols、焦点与手势 | 原生 Preview（适用时）、真实 App |
| 搜索、快速记录的自定义内容区 | SwiftUI / UIKit + bridge | 已有业务状态与主题语义 | 系统搜索输入框、键盘、图片选择与容器适配 | 本轮只做侧栏关联回归，后续单独迁移 |
| 笔记编辑器、卡片、内容排版 | React / WebView | 既有主题和业务语义 | 编辑器及排版设置体系 | 原有整页 fixture 与业务回归，后续迁移 |

## API 与持久化边界

本轮保持 `NativeSurface.palette / rowRadius` 和所有业务 action 的协议形状，保持用户外观与标签偏好存储。静态 token 生成器不决定运行时主题，也不处理业务状态。系统原生组件不消费 Web 菜单的内部尺寸和阴影。

## 历史文档

`docs/BASE_UI_MIGRATION.md`、`docs/IOS_NATIVE_CHROME.md` 是迁移、实现和历史验收记录。现行跨端维护规则以本目录为准；历史尺寸差异须通过组件规格说明，不能静默把某次旧验收当成当前规范。编辑器菜单等不属于侧栏试点，现状差异只登记，不顺带改样式。
