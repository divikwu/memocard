import { useId } from "react";
import { defaults, measurePresets, options, type Typography } from "../../src/features/typography/preferences";
import { useTypography } from "../../src/features/typography/TypographyProvider";
import { Button } from "../components/button";
import { Card, CardContent } from "../components/card";
import { Label } from "../components/label";
import { WebSettingSelect } from "./WebSettingSelect";
import { NoteMarkdown } from "../business/NoteMarkdown";

const labels: Record<keyof Typography, string> = { measure: "行宽", size: "字号", leading: "行高", flow: "段落间距" };
const names: Record<string, string> = { "1.6": "紧凑（1.6）", "1.75": "标准（1.75）", "1.9": "宽松（1.9）", "1em": "紧凑（1em）", "1.25em": "标准（1.25em）", "2em": "宽松（2em）" };
const choiceLabel = (key: keyof Typography, value: string) => key === "measure" ? measurePresets[value].label : key === "size" ? `${value}px 基准` : names[value] ?? value;
const keys = Object.keys(options) as (keyof Typography)[];
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
  return <section aria-labelledby={`${id}-section-heading`}>
    <div className="web-setting-section-heading"><h2 id={`${id}-section-heading`}>内容风格</h2><div className="web-setting-section-actions flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => {
      const next = { ...value };
      for (const key of keys) Object.assign(next, { [key]: options[key][Math.floor(Math.random() * options[key].length)] });
      save(next);
    }}>随机搭配</Button><Button size="sm" variant="ghost" onClick={() => save({ ...defaults })}>恢复默认风格</Button></div></div>
    <p className="text-sm text-secondary">字体跟随外观设置；以下选项仅调整笔记正文和编辑区域的排版。保存在当前设备的浏览器中。字号按 16px 根字号标注基准值，实际文字随浏览器缩放。</p>
    {error && <p role="status" className="text-sm text-error">{error}</p>}
    <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">{keys.map(key => <div key={key}>
      <Label htmlFor={`${id}-${key}`}>{labels[key]}</Label>
      <WebSettingSelect id={`${id}-${key}`} value={value[key]} onValueChange={next => save({ ...value, [key]: next })} options={[
        ...options[key].map(option => ({ value: option, label: choiceLabel(key, option) })),
      ]} />
    </div>)}</CardContent></Card>
    <div role="region" aria-label="笔记排版预览" className="web-note-style-preview"><header><p>实时预览</p><p>随内容风格设置即时更新</p></header><div className="web-note-style-preview-body"><div className="web-note-style-preview-measure"><NoteMarkdown body={preview} /></div></div></div>
  </section>;
}
