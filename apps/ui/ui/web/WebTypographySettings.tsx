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

打开 MemoCard，记下今天的发现，留待日后慢慢整理。

Keep a little room for new ideas. 为灵感留一点空间。

- 用 **关键词** 和 \`#灵感\` 串起想法。`;

export function WebTypographySettings() {
  const id = useId();
  const { value, save, error } = useTypography();
  const field = (key: keyof Typography) => <div key={key}>
    <Label htmlFor={`${id}-${key}`}>{labels[key]}</Label>
    <WebSettingSelect id={`${id}-${key}`} value={value[key]} onValueChange={next => save({ ...value, [key]: next })} options={options[key].map(option => ({ value: option, label: choiceLabel(key, option, value.size) }))} />
  </div>;
  return <section aria-labelledby={`${id}-section-heading`}>
    <div className="web-setting-section-heading"><h2 id={`${id}-section-heading`}>内容风格</h2><Button size="sm" variant="ghost" aria-label="恢复默认风格" onClick={() => save({ ...defaults })}>恢复默认</Button></div>
    <p className="text-sm text-secondary text-pretty">仅保存在当前浏览器。</p>
    {error && <p role="status" className="text-sm text-error">{error}</p>}
    <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">{field("measure")}{field("size")}
      <details className="web-file-status web-appearance-advanced"><summary>高级排版<ChevronDownIcon aria-hidden="true" /></summary><div className="web-setting-card-content web-advanced-fields">{field("leading")}{field("flow")}</div></details>
    </CardContent></Card>
    <div role="region" aria-label="笔记排版预览" className="web-note-style-preview"><header><p>实时预览</p></header><div className="web-note-style-preview-body"><div className="web-note-style-preview-measure"><NoteMarkdown body={preview} /></div></div></div>
  </section>;
}
