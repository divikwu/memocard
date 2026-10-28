import { useId } from "react";
import { defaults, measurePresets, options, type Typography } from "../../src/features/typography/preferences";
import { useTypography } from "../../src/features/typography/TypographyProvider";
import { noteLineHeights } from "../../src/features/typography/scale";
import { Button } from "../components/button";
import { Card, CardContent } from "../components/card";
import { Label } from "../components/label";
import { WebSettingSelect } from "./WebSettingSelect";
import { ChevronDownIcon } from "../icons";
import { NoteMarkdown } from "../business/NoteMarkdown";

const labels: Record<keyof Typography, string> = { measure: "行宽", size: "字号", leading: "行高", flow: "段落间距" };
const names: Record<string, string> = { "1.5": "标准", "1.6": "舒适", "1.75": "宽松", "1.9": "更宽松", "16px": "标准（16px）", "1em": "随字号（1em）", "1.25em": "随字号（1.25em）", "2em": "随字号（2em）" };
const sizeNames: Record<string, string> = { "14": "小字号（14px）", "16": "标准（16px）" };
const choiceLabel = (key: keyof Typography, value: string, size: string) => key === "measure" ? measurePresets[value].label : key === "size" ? sizeNames[value] : key === "leading" ? `${names[value]}（${noteLineHeights[size][value]}px）` : names[value] ?? value;
const preview = `# 把一闪而过的想法留下来

早晨走过熟悉的街道，忽然想到一个新的点子。打开 MemoCard，先把它记下来，再慢慢整理。好的记录不必完整，能留住当时的思路就够了。

Keep a little room for new ideas. 中文与 English 自然地出现在同一段里，让阅读保持流畅，也让每一次回顾都轻松一些。

## 从一个小想法开始

- 记下今天的**发现**，也留下一点疑问。
- 用 \`#灵感\` 串起相关笔记，等有空时继续展开。

> 不急着找到答案，先给想法一个可以停留的地方。`;

export function WebTypographySettings() {
  const id = useId();
  const { value, save, error } = useTypography();
  const field = (key: keyof Typography) => <div key={key}>
    <Label htmlFor={`${id}-${key}`}>{labels[key]}</Label>
    <WebSettingSelect id={`${id}-${key}`} value={value[key]} onValueChange={next => save({ ...value, [key]: next })} options={options[key].map(option => ({ value: option, label: choiceLabel(key, option, value.size) }))} />
  </div>;
  return <section aria-labelledby={`${id}-section-heading`}>
    <div className="web-setting-section-heading"><h2 id={`${id}-section-heading`}>内容风格</h2><Button size="sm" variant="ghost" onClick={() => save({ ...defaults })}>恢复默认风格</Button></div>
    <p className="text-sm text-secondary">字体跟随外观设置；以下选项仅调整笔记正文和编辑区域的排版。保存在当前设备的浏览器中。字号、行高按 16px 根字号标注偶数基准值，实际文字随浏览器缩放。</p>
    {error && <p role="status" className="text-sm text-error">{error}</p>}
    <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">{field("measure")}{field("size")}</CardContent></Card>
    <details className="web-file-status web-appearance-advanced"><summary>高级排版<ChevronDownIcon aria-hidden="true" /></summary><div className="web-setting-card-content web-appearance-fields">{field("leading")}{field("flow")}</div></details>
    <div role="region" aria-label="笔记排版预览" className="web-note-style-preview"><header><p>实时预览</p><p>随内容风格设置即时更新</p></header><div className="web-note-style-preview-body"><div className="web-note-style-preview-measure"><NoteMarkdown body={preview} /></div></div></div>
  </section>;
}
