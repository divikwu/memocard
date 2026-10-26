# 组件归属

唯一生产入口为 `apps/ui/src/main.tsx`；Web、H5、macOS WebView、iOS 内嵌内容和本机服务消费同一 `apps/ui/dist`。目录中的 `ui-next` 是现行实现路径。

| 表面 | 当前实现 | 共享契约 | 平台职责与验证 |
| --- | --- | --- | --- |
| 桌面 Web / 本机 Web / macOS 导航与页面 | `ui-next/components`、`ui-next/business`、`ui-next/web` | 主题、导航、草稿、保存、查询和文件桥接 | DOM、键盘、焦点、悬停和响应式；Storybook、产品浏览器及 macOS App |
| H5 | 同一组 Web 视图 | 同一业务控制器与本机偏好 | Sheet、触摸关闭、软键盘与 safe area；窄屏浏览器和真实设备 |
| iOS 自定义侧栏 | [NativeSidebar](../apps/apple/Sources/NativeSidebar.swift) 与 UIKit 推移容器 | 原生尺寸基准、Lucide、palette、rowRadius、action ID | 系统字体缩放、命中区、安全区和手势；Xcode Preview、Simulator、真机 |
| iOS 导航、菜单、草稿、确认框 | [NativeChrome](../apps/apple/Sources/NativeChrome.swift)、[IOSAppChrome](../apps/ui/ui-next/native/IOSAppChrome.tsx) | 共享 App 状态与 native surface 协议 | SwiftUI / UIKit 控件、材质、焦点、确认和系统选择器 |
| iOS 搜索 / 快速记录 | [NativeDesignedPanel](../apps/apple/Sources/NativeDesignedPanel.swift) 与当前 Web producer | 共享搜索会话、捕获草稿与保存逻辑 | 原生输入、键盘、系统图片选择、ACK 与展示；协议和真实 App 分别验收 |
| 笔记编辑器、集合、属性、回收站、排版 | 当前 `ui-next/business` + `src` 共享内核 | Markdown、撤销、版本检查、附件、属性与恢复 | WebView 内复用；原生返回/固定/删除经 surface 分发 |

## 数据、外观与预览

业务内核与存储桥继续保存在 `apps/ui/src`，不能把该目录当作可整体删除的视图目录。原生 `NativeSurface.palette / rowRadius` 和 action/instance 形状保持；实际颜色与圆角从 Luma CSS 解析，不使用另一套默认 Web 主题。

外观和内容风格按设备/来源存储；标签偏好、固定和正式笔记各按既有协议维护。主题生成和文档索引不写用户数据。系统控件不消费 Web 菜单的内部尺寸或阴影。

Storybook 与状态 Preview 用显式内存 fixture；原生 Preview 使用隔离 Host，禁止加载真实 WebView、vault 或服务。真实浏览器沙盒、Simulator probe 与用户 QA 库验收分别报告。

现行维护见[设计入口](README.md)、[组件维护表](component-inventory.md)和[清理记录](ui-retirement-2026-10-25.md)。[Base UI 迁移](../docs/BASE_UI_MIGRATION.md)与[iOS 外壳记录](../docs/IOS_NATIVE_CHROME.md)保留其历史批次和验收日期，不作为当前源码路径表。
