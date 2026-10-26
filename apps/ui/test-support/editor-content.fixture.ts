export const editorContentReview = `# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

正文包含 **粗体**、*斜体*、~~删除线~~、\`inline code\` 和 [参考链接](https://example.com)。

- 项目符号列表
  - 嵌套内容
  - 第二项
- 另一个项目

1. 有序列表
2. 保留编号与缩进

- [ ] 待办事项
- [x] 已完成事项

> 引用内容保持与正文一致的阅读节奏。

<aside data-callout="blue" data-callout-icon="🧭"><p>标注只显示一个图标；点击图标可以继续编辑。</p></aside>

\`\`\`ts
const message = "MemoCard";
const longLine = "窄屏代码在内容块内横向滚动，不撑宽页面";
\`\`\`

\`\`\`mermaid
flowchart LR
A[输入] --> B[整理] --> C[回顾]
\`\`\`

| 内容 | WEB | H5 | 选择与撤销 |
| --- | --- | --- | --- |
| 表格单元格 | 同一份 Markdown | 支持块内横向滚动 | 保留 |
| 多级内容 | 标题与列表 | 窄屏换行 | 保留 |

行内公式 $E=mc^2$ 与块级公式：

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

带编号的脚注引用[^ui]。

[^ui]: 脚注定义保持编号可见，并保留引用跳转。

---`;
