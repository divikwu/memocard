# 编辑器与原生笔记页外壳

## 维护边界

标题、正文、保存与恢复草稿由生产 `Editor` / `EditorSession` 管理，富文本仍使用 `RichMarkdownEditor`。桌面、H5 与 iOS WKWebView 共用这些 Web 组件。iOS 的导航栏、标题菜单、固定和页面操作继续由 `NativeMainChrome` 与系统控件负责。

Storybook 入口为 `business/editor`，直接使用真实 Editor 和 NoteCollection。示例调用方通过现有 `EditorHandle.finish()` 请求返回；保存失败时停留在编辑页，真实“重试保存”成功后返回集合，再次打开读取已提交的内存笔记。fixture 只接受指定笔记、绑定、路径与当前版本，未知操作拒绝；保存和恢复草稿均不会访问真实笔记库。

场景覆盖标题/正文编辑与自动保存、失败保留/重试/返回/重新打开、挂起保存时的禁用状态、只读，以及 H5 的相同保存闭环与既有焦点策略。示例导航按钮和“完成模拟保存”属于调用方或场景控制，不是新增产品按钮。

## Xcode Preview

选择 `MemoCardiOS` 与 iPhone Simulator，在 `NativeChrome.swift` 打开 Canvas：

- `Main Chrome · Collection`：标题布局菜单与打开示例笔记。
- `Main Chrome · Detail`：原生返回、固定和页面操作反馈；“新建”等页面操作只记录回调，不伪造未保存编辑器。
- `Main Chrome · Busy`：原生动作禁用状态。
- `Main Chrome · Dark Large`：深色与大字配置。

这些入口复用真实 `NativeMainChrome`，仅 DEBUG 注入只读占位正文与内存 surface 反馈。预览 host 即使未注入正文也不创建 WKWebView，不打开笔记库或启动服务；普通 App 仍走原有 WebView。正文占位和上方场景控制明确用于原生外壳验收，不代表 SwiftUI 编辑器或真实保存。

## 验收

Storybook 的 play 检查真实输入、提交载荷、失败期间草稿与已保存值分离、重试后读回及返回集合。Xcode Preview 检查实际原生布局和动作反馈。iPhone 必须另验实际 WKWebView 编辑与原生返回；隔离内存故障和真实库保存分别记录，不通过破坏目录权限或修改产品故障开关制造失败。

执行 `pnpm verify:design`、`pnpm verify`、`pnpm test:native-surfaces` 及 iOS 构建，结果更新到 [validation.md](../validation.md)。这批场景不声明覆盖全部富文本节点、中文输入法、冲突解决、系统选择器、旧系统或真机。
