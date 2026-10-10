# Codex 空间文档编辑器实现研究

研究日期：2026-10-08。对象：用户截图中的空间 Page 正文编辑器。

结论：本机所安装版本的空间文档，以 **React 界面、自定义 ProseMirror 编辑层、Markdown 文档转换层、Yjs 块文档及自定义同步会话** 组合实现。不是仅凭外观推测，也不能据此认定它与 Craft 使用相同实现。

## 证据与范围

- 本机安装包：`/Applications/ChatGPT.app/Contents/Resources/app.asar`，应用版本 `26.1002.52244`，build `13536`。只读检查其中已交付的前端代码。
- 官方产品说明：[Work with pages](https://learn.chatgpt.com/docs/space/pages)。官方确认块、插入菜单、选区工具栏、块拖动、评论、实时协作、Agent 等产品能力，没有公开说明底层编辑库。
- 用户截图：用于确定目标界面。没有读取或修改截图中的待办事项，也没有访问账户数据库、令牌或文档正文。
- 当前仓库：静态核对 `apps/ui/src/RichMarkdownEditor.tsx` 和 `apps/ui/package.json`。
- 本次没有现场编辑空间 Page，没有验证中文 IME、断网恢复、多人冲突、性能或完整可访问性。客户端代码存在某项机制，不等于该机制已经实测通过。

结论限定在上述安装版本；服务端内部实现及其他版本不能直接外推。

## 1. 确认是空间 Page 的编辑器

调用链可追踪到：

```text
space-page-93054e78a987.js
  → editor-7d4cfd4b7327.js：页面类型判断、访问权限、编辑会话
  → app-initial-61c077dcc1af.js：惰性加载 PageEditorContent
  → content-6f04a4419830.js：导出 PageEditorContent
  → 页面编辑器工厂和自定义 pluginStack
  → ProseMirror EditorState / EditorView
```

页面类型为 `page` 时进入上述正文编辑器；表格、演示文稿等其他类型另走 artifact 编辑器。`slate-page` 这个资源名不能用于认定其使用 Slate.js。

`content-6f04a4419830.js` 内的 `codex.space.page.controls.dragHint` 包含截图对应的握柄提示，说明拖动/点击菜单属于这条 Page 实现。标题章节握柄与列表握柄还有不同的操作提示。

## 2. 编辑内核：直接使用 ProseMirror

`app-initial-61c077dcc1af.js` 的编辑器工厂直接创建编辑状态和编辑视图，使用 schema、nodeViews、插件栈、键盘映射及 `dispatchTransaction`。

其事务流程是：

1. 接收编辑事务，执行预处理。
2. `applyTransaction` 得到新状态及插件追加的事务。
3. 执行可选的后续事务。
4. 更新编辑视图。
5. 通知文档同步桥接层；需要时序列化 Markdown 并调用变更回调。

不是每次键入都重新替换整个 DOM。正文编辑状态与 React 的外围组件状态分工明确。页面初始化代码取得一个 `view` 并初始化文档桥接插件，支持将多个存储块投影为连续的正文。

**没有在这条调用链看到 Tiptap 的 Editor/useEditor 封装。** 因而更准确的描述是“直接构建的自定义 ProseMirror 编辑器”，而不是“已确认使用 Tiptap”。同样没有证据支持它在这里使用 Lexical、BlockNote 或 Slate.js。

## 3. Markdown 与块文档共存

客户端 Page 文档的 canonical roots 可确认如下：

| 根 | 类型与用途 |
|---|---|
| `title` | Y.Text，页面标题 |
| `blocksById` | Y.Map，按稳定 ID 索引块 |
| `topLevelBlockIds` | Y.Array，顶层块顺序 |
| `comments` | 可选的 Y.Map，评论数据 |
| `pagesMetadata` | 可选的 Y.Map，页面元数据 |

每个块包含 `kind`、`markdown` 文本和可选 metadata。可见块种类包括普通 Markdown 与 Agent Instructions；Markdown 文本为 Y.Text，metadata 为 Y.Map。插入块时，在一个 Yjs transaction 内同时创建块数据及插入顺序 ID。

因此至少存在三种不同坐标：

- 文档层：块 ID、顺序、Markdown 文本。
- 编辑层：ProseMirror 节点、文本位置和选区。
- 展示层：段落、列表项、表格、引用、媒体及交互控件。

这些层通过解析、序列化、文档 projection 和位置映射衔接。**不能把一个可见握柄、一个列表项、一个 ProseMirror 节点都视为独立存储块**；列表内部节点与文档存储单元可能不同。

Yjs 的识别不仅依据类名猜测：同一前端模块包含 Yjs 自身的诊断字符串、共享类型和 UndoManager 实现，Page 根读取及创建逻辑使用这些共享类型。

这个模型确实保留 Markdown 文本，但不能等同于本地 `.md` 文件，也没有证明任意 Markdown 语法逐字无损往返。

## 4. 截图中的交互怎样实现

| 交互 | 客户端实现证据 | 工程含义 |
|---|---|---|
| `/` 插入 | 自定义 slash 菜单及插件；命令带 capability/context 判断 | 空段落、选区、表格及权限不同，可用命令也不同 |
| `@` 提及 | 提及插件、引用解析及页面/文件/聊天导航 | 文本输入与应用实体系统连接，不是仅插入一段标签文字 |
| 选区浮动工具栏 | 页面工具栏 + ProseMirror selection/marks；共享 writing 编辑工具 | 样式命令需要了解普通文本、多块和表格选区 |
| 握柄 | 自定义 Page 控件，点击打开选项、拖动重排 | 控件显示、命中范围、拖动目标与编辑事务是不同职责 |
| 标题章节拖动 | 提示及结构逻辑覆盖标题到下一同级/更高级标题之前的内容 | 目标是语义章节，不能只移动标题节点 |
| 列表拖动 | 列表项控制；Option/Alt 时提示移动整个所属列表 | 子项、整个列表、普通块需要不同移动规则 |
| 表格 | 单元格编辑/结构选择状态、Decoration、键盘及粘贴处理 | 不是普通段落节点换成 table 标签就能完成 |
| 图片、文件、Prompt、Task、可视化 | NodeView 注册、专用 store 与服务桥接 | 富媒体和应用控件由独立渲染/状态逻辑接入 |
| 空段落提示 | ProseMirror Decoration 及上下文判断 | 提示不必成为真实文档内容 |

官方帮助同时确认这些产品交互，包括选区修改/评论、块移动、章节/列表操作及实时协作。这里的实现归因来自安装包，帮助文档只用于核对产品语义。

## 5. 评论为何能够跟随文本

页面代码将 ProseMirror 选区映射到块内 Markdown 的偏移，随后以 **块 ID + Yjs 相对位置** 保存范围两端；字段中能看到 `relativePositionBase64` / `relative_position_base64`。

重新显示评论时，再解析共享文本位置并映射回编辑器坐标，使用 Decoration 显示对应范围。因此评论不是仅绑定当前 DOM 元素或固定像素位置。

这是重要的架构细节：若保存坐标只有“第几段、第几个字符”，插入、移动和协作编辑后的评论容易错位。但本次没有实测块删除、复杂 Markdown 重写等情况下的锚点效果。

## 6. 保存和同步是独立的工程层

Page 会话实现可见：

- canonical 与 live 两份文档状态，服务器序号、当前本地 revision、远端 revision。
- pending updates、已退役/隔离更新 ID、发送封口状态和重新同步逻辑。
- 编辑事务连续性检查；本地 revision 不匹配或会话尚未就绪时拒绝提交。
- 恢复草稿与 deferred editor drafts，防止拒绝的内容直接丢失。
- IndexedDB 中的 `codex-page-documents` 文档缓存。
- IndexedDB 中的 `codex-page-pending-writes`，含 journals、operations、documents、baselines。
- save waiter 区分服务端接受等进度，不能把视图已显示视为保存已完成。

可以确认客户端有 Yjs 共享文档、乐观更新、序号确认、本地写入日志和恢复机制。**不能仅因采用 Yjs 就认定服务端完全使用标准 y-websocket/y-prosemirror，也不能推断服务端数据库。** 此处存在自定义 ProseMirror 与 Markdown/Yjs 的桥接，而不是已经确认的通用 XML 文档绑定方案。

同样，存在 IndexedDB 机制不足以承诺完整离线使用；退出、重新登录、浏览器清理或权限撤销后的具体行为仍需实测。

## 7. AI 编辑与手动编辑如何连接

页面代码使用稳定块 ID 寻址，存在删除块、替换块 Markdown、带多个 block units 的替换等结构操作。人工 ProseMirror 事务通过 `applyEditor` 与文档会话连接，并使用 base live revision 检查是否仍基于当前文档。

还能看到用于 agent 变更历史的独立 ProseMirror Step，以及 Yjs UndoManager 参与的处理。说明 AI 写入并非只有“生成一段 HTML 替换页面”：它要处理文档结构、并发状态、撤销和失败恢复。

但不能据客户端判断所有 AI 操作路径都使用同一协议，或推断服务端如何生成修改。

## 8. 对 MemoCard 的意义

当前代码已经使用 Tiptap 3 / ProseMirror，依赖版本范围为 `^3.31.3`，并通过 `MarkdownSource` 保护源文。**基础编辑内核属于同一体系，没有因为空间界面更成熟就必须迁移编辑器框架。**

| 层 | Codex 空间 | MemoCard 当前核对 |
|---|---|---|
| 编辑内核 | 自定义 ProseMirror | Tiptap 包装的 ProseMirror |
| 持久模型 | 带稳定块 ID 的 Yjs 文档及块 Markdown | 本地 Markdown 与源文保护层 |
| 产品交互 | 页面插件、上下文命令、块/表格操作、评论与 Agent | 自定义工具栏、块选择/移动等已有实现 |
| 同步与恢复 | 协作会话、服务端确认、日志及恢复草稿 | 本地笔记保存链路；本次不重新验收历史实现 |

值得优先借鉴的是：

1. **操作目标一致性**：区分文本范围、多个块、列表项、整列表、标题章节、表格结构，让握柄提示与实际命令范围一致。
2. **位置映射与事务约束**：菜单、拖动、AI 或外部内容更新之前核对文档状态；操作结束后保留合理选区，撤销应按用户动作组织。
3. **输入状态保护**：源码存在 `isComposing`、composition 事件、焦点与拖动清理处理；MemoCard 应以真实中文输入验收这些路径，而非照搬事件名。
4. **可靠保存反馈**：区分“视图已编辑”“已进入保存队列”“落盘完成”“冲突/失败”；继续用磁盘与重开证明本地保存。

仅当产品明确需要多人协作、跨设备评论或 AI 精确修改时，再评估持久块 ID、协作数据模型和相对位置。为改善写作体验直接引入整套 Yjs 同步系统，会扩大当前本地 Markdown 产品的范围。

## 可复查的证据入口

以下均为上述 `app.asar` 内部资源路径，不是公开源码仓库：

| 资源 | 复查标记 |
|---|---|
| `webview/assets/space-page-93054e78a987.js` | `pageId`、编辑器模块导入 |
| `webview/assets/editor-7d4cfd4b7327.js` | `page` 类型分支、session、惰性正文组件 |
| `webview/assets/content-6f04a4419830.js` | `PageEditorContent`、`codex.space.page.controls.dragHint`、`relativePositionBase64`、`baseLiveRevision`、页面插件栈 |
| `webview/assets/app-initial-61c077dcc1af.js` | `PageEditorContent` 动态导入、`blocksById`、`topLevelBlockIds`、`applyEditor`、`codex-page-pending-writes`、`codex-page-documents` |
| `webview/assets/writing-block-editor-64d7838f04de.js` | marks 命令、外部更新处理、选区菜单共享工具 |
| `webview/assets/writing-block-markdown-editor-587dd68d5b8f.js` | 共享 Markdown 编辑视图封装；不能仅凭这个文件认定整个 Page 的同步方案 |
| `apps/ui/src/RichMarkdownEditor.tsx` | `useEditor`、`@tiptap/pm`、`MarkdownSource` |

本次仅增加研究文档，没有改动已有编辑器实现、用户笔记或应用安装包。
