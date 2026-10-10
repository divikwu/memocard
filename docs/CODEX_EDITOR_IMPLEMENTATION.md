# 借鉴 Codex 空间的编辑器优化：实施与验收

日期：2026-10-08。研究依据：[Codex 空间编辑器研究](CODEX_SPACES_EDITOR_RESEARCH.md)。

## 本轮目标

让块操作的实际移动范围与提示一致：标题带着章节内容移动，列表项与整张列表有明确区别，显式多块选区保持用户选择的范围。继续使用现有 Tiptap / ProseMirror 和本地 Markdown 保存方式。

本轮自主实现这些操作语义，没有复制 Codex 安装包中的代码，没有引入 Yjs、协作会话或改变笔记存储模型。

## 实现结果

- 单个标题的拖动和菜单移动包含其后正文、子标题及子标题正文，到下一个同级或更高级标题为止。
- 菜单提供“上移章节 / 下移章节”，与同级章节交换位置，不跨越所属的更高级标题；提示显示包含的块数，复制、删除、转换仍以原有显式选区为准。
- 列表项握柄默认移动当前项；Option / Alt 拖动移动最近的整个列表，携带嵌套内容。
- 显式多块选区不自动扩大为章节或整列表。
- 顶层章节、整列表的拖动落点落在目标顶层块旁，避免将整段结构插入目标的嵌套列表项。
- 继续复用已有事务校验、组合输入保护、移动后的块选区和独立撤销记录；过期拖动内容会被拒绝。

主要代码：`apps/ui/src/rich-blocks.ts`、`apps/ui/src/RichMarkdownEditor.tsx`。相关测试位于 `rich-blocks.test.ts`、`RichMarkdownEditor.test.tsx`、`wysiwyg-core.test.ts`。

## 自动化验证

最终 `pnpm verify` 退出码为 0：

| 检查 | 结果 |
|---|---|
| UI | 27 个文件，324 项通过；本轮新增 12 项 |
| MCP | 16 项通过 |
| Native Core | 34 项通过 |
| Native Network | 8 项通过 |
| Local Web | 9 项通过 |
| 类型检查、Lint、构建、Bundle 预算 | 通过 |

新增覆盖包含章节边界、同级章节交换、显式选区、过期拖动、整列表及嵌套内容、目标列表落点、一次撤销/重做，以及 Markdown 注释、原始列表标记、有序列表起始编号和待办勾选状态的往返。

验证仍输出现有 `LiveMarkdownEditor.tsx:508` 的 Hook 依赖警告和构建的大 chunk 提示，均未阻断检查；本轮没有调整相邻代码或扩大预算。

完整检查日志：`/tmp/memocard-codex-sections-verify-final.log`。服务构建日志：`/tmp/memocard-codex-sections-service-build.log`。

## 真实保存验收

更新并安装本地 `MemoCardService.app`，签名校验通过。通过 Chrome 的真实 service-hosted 页面验收，服务监听 `127.0.0.1:58080`；已核对当前笔记库为 `MemoCard-M1-Test-20260928`，不是 mock 或独立浏览器目录模式。

仅新建合成测试笔记：`Codex 章节操作验收 2026-10-08（合成测试）`，ID 为 `a6a74b8a-a16f-4ea2-b980-4772c5e9b387`。保留该笔记便于复查。

验收链路：

1. 输入两个同级章节，其中第一章带正文和子标题，并加入 `CODEX-SECTION-SAVE` 标记及嵌套列表；初始 Markdown 与磁盘文件逐字一致。
2. 打开第一章握柄菜单，确认包含 4 个块，且“上移章节”不可用。
3. 点击“下移章节”，确认章节及子内容一同移动到第二章之后。
4. Command-Z 单步撤销，磁盘正文与原始 Markdown 逐字一致。
5. Command-Shift-Z 单步重做，磁盘正文与预期移动结果逐字一致。
6. 刷新页面后重新核对笔记库、笔记标题、章节 B → 章节 A 的顺序、子内容和标记，内容保留。

磁盘证据：`~/Library/Mobile Documents/com~apple~CloudDocs/MemoCard-M1-Test-20260928/notes/a6a74b8a-a16f-4ea2-b980-4772c5e9b387.md`。原始测试正文：`/tmp/memocard-codex-sections-original.md`。

浏览器中途被切换到其他页面时，工具中止了动作；该动作没有记为通过。最终回到正确笔记页后完成重做和刷新验证。

## 验收边界

- 章节菜单移动、真实撤销/重做、磁盘保存、刷新读取：已验证。
- 标题拖动、Option / Alt 整列表拖动、Esc 取消及落点保护：自动化事件测试通过；尚未完成真实鼠标拖动及拖动期间取消的设备验收。
- 原生中文 IME、触摸操作、真实跨段选区：本轮未验证。
- 长文性能、窄屏及深浅色完整视觉矩阵、独立 Chrome / Edge 目录模式：本轮没有重新验收。

本轮目标完成不代表整个编辑器已经达到 Craft 或 Codex 空间的全部体验水平。
