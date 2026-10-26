import { scenarios as sharedScenarios } from "../../ui-state-fixtures/catalog";
export { noteId } from "../../ui-state-fixtures/catalog";

const instructions: Record<string, string> = {
  "disconnected": "检查本机服务断开后的连接说明和重新打开入口；预览不会启动真实服务。",
  "unauthorized": "检查本机授权失效后的恢复引导；预览不会打开真实应用。",
  "folder-cancel": "已模拟文件夹授权未完成；检查提示，点击“重新选择文件夹”可模拟恢复。",
  "draft-versions": "已打开保留草稿；检查同一笔记的两个版本与待保存属性是否可区分，可继续编辑其中一个版本。",
  "draft-dismissed": "已打开保留草稿；检查“已关闭提醒”标识，内容仍可继续编辑。",
  "property-save-error": "点击“摘要”的值，修改后按 Enter；检查保存错误、内容保留与重试保存。",
  "date-invalid": "点击“日期”，在日期输入框中输入 99/99/2026，按 Enter 或移开焦点，检查错误；修正为有效的 MM/DD/YYYY 日期后可保存。",
  "image-import-error": "编辑器“内容块操作” → “在下方插入” → “图片”，模拟图片超过 20 MB；不会打开真实文件选择器。",
  "theme-storage-error": "在“外观”中更改主题或强调色，检查设置无法保存的提示；当前会话中的选择仍然有效。",
  "font-error": "检查设置页的字体回退提示与“重试加载字体”；此场景持续模拟字体加载失败。",
  "filter-empty": "已选择“有图片”筛选，检查筛选无结果状态；点击“查看所有笔记”应恢复列表。",
};
export const scenarios = sharedScenarios.map(scenario => ({ ...scenario, ...(scenario.id === "image-loading" ? { detail: true } : {}), instructions: instructions[scenario.id] ?? scenario.instructions }));
export type Scenario = (typeof scenarios)[number];
export const getScenario = (id: string | null) => scenarios.find(scenario => scenario.id === id) ?? scenarios[0];
