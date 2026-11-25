import { useId } from "react";
import { defaults, measurePresets, options, type Typography } from "../../src/features/typography/preferences";
import { useTypography } from "../../src/features/typography/TypographyProvider";
import { noteLineHeights, noteParagraphGap, STANDARD_PARAGRAPH_GAP } from "../../src/features/typography/scale";
import { Button } from "../components/button";
import { Card, CardContent } from "../components/card";
import { WebSettingSelect } from "./WebSettingSelect";

const labels: Record<keyof Typography, string> = { measure: "行宽", size: "字号", leading: "行高", flow: "段落间距" };
const names: Record<string, string> = { "1.5": "标准", "1.6": "舒适", "1.75": "宽松", "1.9": "更宽松" };
const sizeNames: Record<string, string> = { "14": "小字号（14px）", "16": "标准（16px）" };
const choiceLabel = (key: keyof Typography, value: string, size: string) => key === "measure" ? measurePresets[value].label : key === "size" ? sizeNames[value] : key === "leading" ? `${names[value]}（${noteLineHeights[size][value]}px）` : value === defaults.flow ? `标准（${STANDARD_PARAGRAPH_GAP}px）` : `随字号（${noteParagraphGap(size, value)}px）`;

export function WebTypographySettings() {
  const id = useId();
  const { value, save, error } = useTypography();
  const field = (key: keyof Typography) => <WebSettingSelect key={key} id={`${id}-${key}`} label={labels[key]} value={value[key]} onValueChange={next => save({ ...value, [key]: next })} options={options[key].map(option => ({ value: option, label: choiceLabel(key, option, value.size) }))} />;
  return <section aria-labelledby={`${id}-section-heading`}>
    <div className="web-setting-section-heading"><h2 id={`${id}-section-heading`}>内容风格</h2><Button variant="ghost" className="text-secondary" aria-label="恢复默认风格" onClick={() => save({ ...defaults })}>恢复默认</Button></div>
    {error && <p role="status" className="text-sm text-error">{error}</p>}
    <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">
      {field("measure")}{field("size")}{field("leading")}{field("flow")}
    </CardContent></Card>
  </section>;
}
