# 标题章节折叠与编辑入口精简

验收日期：2026-10-09。参考 Codex Pages 的入口分工；本次没有复制其内部实现，也没有新增 Markdown 语法。

## 完成范围

- 移除块菜单的“块属性与更多操作”聚合入口及其面板。块菜单保留转换、插入、复制、移动、删除。
- 文字选区的“更多格式”保留，包含高亮、上下标、键盘标记、缩写和链接编辑。
- 原有脚注、图片、折叠块、定义列表等 Markdown 解析与保留能力不变；原聚合面板中的块级编辑入口不再提供。
- 有章节内容的标题旁显示折叠箭头。章节结束于同级或更高级标题；嵌套子章节的收起状态在父章节展开后保留。
- 默认展开。折叠状态仅属于当前编辑器视图，切换笔记或重新加载后重置，不写入 Markdown、不触发保存、不进入撤销历史。

## 实现与交互

`richSectionEnd` 同时服务于章节移动和折叠范围计算。ProseMirror 插件用位置映射维护折叠状态，以 decorations 隐藏章节节点，不删除内容或修改节点属性。

折叠按钮沿用 Base UI，提供中文名称、`aria-expanded` 和 Enter／Space 操作。不添加展开动画。显式编辑器选区导航进入隐藏内容时会展开对应章节；这不等同于浏览器原生查找集成。

光标位于收起标题末尾按 Delete，或下一章节开头按 Backspace，先展开内容而不立即修改隐藏文字。组合输入期间不执行这类快捷操作。

沿用现有响应式留白，不新增断点。标题折叠按钮和拖拽手柄均为 24px，横向间隔 8px；菜单项继续使用 36px 高度。375px 窄屏中手柄仍在页面内，没有横向溢出。

## 验证

- `pnpm verify` 通过：UI 383、MCP 16、Swift 35、原生网络 8、本地 Web 9，共 451 项测试；类型、lint、构建、UI primitives 和 bundle 门禁通过。
- 首屏 gzip 为 214712 / 215040 bytes，未提高预算。保留既有 `LiveMarkdownEditor.tsx` 的 effect 依赖警告与 Vite 大 chunk 提示，无新增 lint 警告。
- `pnpm build:service`、`pnpm install:service`、应用签名校验通过。安装应用的 Web 资源与本次 `apps/ui/dist` 完全一致。
- 实际授权服务 `127.0.0.1:56903` 验收：点击、Enter、Space 展开／收起；折叠时打开块菜单不会展开章节；菜单项实测 36px；1490×1243 与 375×812 布局检查通过；浏览器无 warn/error 日志。
- 验收笔记前后 DOM 文本相同，没有编辑用户笔记。嵌套折叠、位置映射、内容保留、外部笔记替换、删除边界和组合输入保护由自动测试覆盖。
- 尚未手工验证真实中文 IME、触摸设备、深色模式和浏览器原生查找；窄屏证据来自桌面浏览器视口，不等同于真机验收。

日志：`/tmp/memocard-heading-verify-final.log`、`/tmp/memocard-heading-service.log`、`/tmp/memocard-heading-install.log`。安装前备份：`/tmp/memocard-heading-backup.4QxSZz/`。服务进程及原有 vault 保留。没有提交或推送 Git；没有清理其他工作区改动。

## 页面证据

- [默认展开](memocard-heading-expanded.jpg)
- [章节收起](memocard-heading-collapsed.jpg)
- [精简后的块菜单](memocard-heading-menu.jpg)
- [375px 窄屏](memocard-heading-narrow.jpg)
