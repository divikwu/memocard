import { TypographySettings } from "@/features/typography/TypographySettings";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FONT_FAMILIES, FONT_GROUPS, type FontChoice } from "@/lib/font-options";
import { useTheme } from "./ThemeProvider";
import { NEUTRAL_VALUES, PALETTE_VALUES, type RadiusChoice, type Theme } from "./preferences";

const modes: { value: Theme; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];
const radii: { value: RadiusChoice; label: string }[] = [
  { value: "none", label: "无" },
  { value: "xs", label: "极小" },
  { value: "sm", label: "小" },
  { value: "md", label: "适中" },
  { value: "lg", label: "标准" },
  { value: "xl", label: "大" },
  { value: "2xl", label: "更大" },
];
const paletteLabels = { lime: "青柠", green: "绿色", emerald: "翠绿", teal: "青绿", cyan: "青色", sky: "天蓝", blue: "蓝色", mono: "黑白" };
const neutralLabels = { slate: "冷灰", neutral: "中性灰" };
const fontLabels = Object.fromEntries(FONT_GROUPS.flatMap(group => group.options.map(font => [font.value, font.label]))) as Record<FontChoice, string>;

function FontSelect({ label, value, onChange }: { label: string; value: FontChoice; onChange: (value: FontChoice) => void }) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
      <p className="min-w-0 text-sm">{label}</p>
      <Select value={value} onValueChange={next => { if (next) onChange(next as FontChoice); }}>
        <SelectTrigger aria-label={label} className="w-full shrink-0 shadow-none sm:w-48">
          <SelectValue style={{ fontFamily: FONT_FAMILIES[value] }}>{fontLabels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="max-h-80">
          {FONT_GROUPS.map(group => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map(font => (
                <SelectItem key={font.value} value={font.value} style={{ fontFamily: FONT_FAMILIES[font.value] }}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ThemeSettings() {
  const theme = useTheme();
  const radius = radii.find(option => option.value === theme.radius)!;
  return (
    <><section aria-labelledby="appearance-heading" className="space-y-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h2 id="appearance-heading" className="text-balance text-base font-medium">外观</h2>
        <Button variant="ghost" size="sm" onClick={theme.resetAppearance} className="shrink-0 text-muted-foreground">
          <RotateCcw aria-hidden="true" />恢复默认
        </Button>
      </div>
      <Card className="gap-0 py-0 shadow-none"><CardContent className="px-4">
      {theme.persistenceError && <p role="status" className="mt-4 text-sm text-destructive">无法保存设置；当前已生效，重开后可能恢复默认。</p>}
      <div className="divide-y divide-border/60">
        <div className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 space-y-1"><p className="text-sm font-medium">显示模式</p><p className="text-pretty text-sm text-muted-foreground">选择浅色、深色或跟随系统。</p></div>
          <Select value={theme.theme} onValueChange={next => { if (next) theme.setTheme(next as Parameters<typeof theme.setTheme>[0]); }}>
            <SelectTrigger aria-label="显示模式" className="w-full shrink-0 shadow-none sm:w-48">
              <SelectValue>{modes.find(mode => mode.value === theme.theme)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {modes.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 space-y-1"><p className="text-sm font-medium">强调色</p><p className="text-pretty text-sm text-muted-foreground">用于按钮和选中状态。</p></div>
          <Select value={theme.palette} onValueChange={next => { if (next) theme.setPalette(next as Parameters<typeof theme.setPalette>[0]); }}>
            <SelectTrigger aria-label="强调色" className="w-full shrink-0 shadow-none sm:w-48">
              <SelectValue className="capitalize">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-foreground/10" style={{ backgroundColor: `var(--palette-${theme.palette}-swatch)` }} />
                {paletteLabels[theme.palette]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {PALETTE_VALUES.map(value => (
                  <SelectItem key={value} value={value} className="capitalize">
                    <span aria-hidden="true" className="size-2.5 shrink-0 self-center rounded-full border border-foreground/10" style={{ backgroundColor: `var(--palette-${value}-swatch)` }} />
                    {paletteLabels[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Collapsible className="-mx-4">
          <CollapsibleTrigger render={<Button variant="ghost" className="group h-14 w-full justify-between rounded-none rounded-b-xl px-4 has-[>svg]:px-4 data-[panel-open]:rounded-b-none"><span>高级外观</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground group-data-[panel-open]:rotate-180" /></Button>} />
          <CollapsibleContent className="divide-y divide-border/60 px-4">
        <div className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
          <p className="min-w-0 text-sm">中性色</p>
          <Select value={theme.neutralPalette} onValueChange={next => { if (next) theme.setNeutralPalette(next as Parameters<typeof theme.setNeutralPalette>[0]); }}>
            <SelectTrigger aria-label="中性色" className="w-full shrink-0 shadow-none sm:w-48">
              <SelectValue className="capitalize">{neutralLabels[theme.neutralPalette]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {NEUTRAL_VALUES.map(value => <SelectItem key={value} value={value} className="capitalize">{neutralLabels[value]}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <FontSelect label="标题字体" value={theme.headingFont} onChange={theme.setHeadingFont} />
        <FontSelect label="正文字体" value={theme.bodyFont} onChange={theme.setBodyFont} />
        <div className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
          <p className="min-w-0 text-sm">圆角</p>
          <Select value={theme.radius} onValueChange={next => { if (next) theme.setRadius(next as Parameters<typeof theme.setRadius>[0]); }}>
            <SelectTrigger aria-label="圆角" className="w-full shrink-0 shadow-none sm:w-48">
              <SelectValue>{radius.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {radii.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </CardContent></Card>
    </section><TypographySettings /></>
  );
}
