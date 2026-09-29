import { RotateCcw } from "lucide-react";
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
const radii: { value: RadiusChoice; label: string; pixels: number }[] = [
  { value: "none", label: "无", pixels: 0 },
  { value: "xs", label: "XS", pixels: 4 },
  { value: "sm", label: "SM", pixels: 6 },
  { value: "md", label: "MD", pixels: 8 },
  { value: "lg", label: "LG", pixels: 10 },
  { value: "xl", label: "XL", pixels: 12 },
  { value: "2xl", label: "2XL", pixels: 16 },
];
const fontLabels = Object.fromEntries(FONT_GROUPS.flatMap(group => group.options.map(font => [font.value, font.label]))) as Record<FontChoice, string>;

function FontSelect({ label, value, onChange }: { label: string; value: FontChoice; onChange: (value: FontChoice) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="min-w-0 text-sm">{label}</p>
      <Select value={value} onValueChange={next => { if (next) onChange(next as FontChoice); }}>
        <SelectTrigger aria-label={label} className="w-40 shrink-0 sm:w-48">
          <SelectValue style={{ fontFamily: FONT_FAMILIES[value] }}>{fontLabels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" position="popper" className="max-h-80">
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
    <Card aria-labelledby="appearance-heading"><CardContent>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id="appearance-heading" className="text-sm font-medium">外观</h2>
          <p className="text-sm text-muted-foreground">仅应用于这台设备。</p>
        </div>
        <Button variant="ghost" size="sm" onClick={theme.resetAppearance} className="shrink-0 text-muted-foreground">
          <RotateCcw aria-hidden="true" />恢复默认
        </Button>
      </div>
      {theme.persistenceError && <p role="status" className="mt-4 text-sm text-destructive">外观已应用，但当前无法保存设置。重新打开应用后可能恢复默认。</p>}
      <div className="mt-4 divide-y divide-border/60">
        <div className="flex items-center justify-between gap-4 py-3">
          <p className="min-w-0 text-sm">显示模式</p>
          <Select value={theme.theme} onValueChange={next => { if (next) theme.setTheme(next as Parameters<typeof theme.setTheme>[0]); }}>
            <SelectTrigger aria-label="显示模式" className="w-40 shrink-0 sm:w-48">
              <SelectValue>{modes.find(mode => mode.value === theme.theme)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" position="popper">
              <SelectGroup>
                {modes.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <p className="min-w-0 text-sm">强调色</p>
          <Select value={theme.palette} onValueChange={next => { if (next) theme.setPalette(next as Parameters<typeof theme.setPalette>[0]); }}>
            <SelectTrigger aria-label="强调色" className="w-40 shrink-0 sm:w-48">
              <SelectValue className="capitalize">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-foreground/10" style={{ backgroundColor: `var(--palette-${theme.palette}-swatch)` }} />
                {theme.palette}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" position="popper">
              <SelectGroup>
                {PALETTE_VALUES.map(value => (
                  <SelectItem key={value} value={value} className="capitalize">
                    <span aria-hidden="true" className="size-2.5 shrink-0 self-center rounded-full border border-foreground/10" style={{ backgroundColor: `var(--palette-${value}-swatch)` }} />
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <p className="min-w-0 text-sm">中性色</p>
          <Select value={theme.neutralPalette} onValueChange={next => { if (next) theme.setNeutralPalette(next as Parameters<typeof theme.setNeutralPalette>[0]); }}>
            <SelectTrigger aria-label="中性色" className="w-40 shrink-0 sm:w-48">
              <SelectValue className="capitalize">{theme.neutralPalette}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" position="popper">
              <SelectGroup>
                {NEUTRAL_VALUES.map(value => <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <FontSelect label="标题字体" value={theme.headingFont} onChange={theme.setHeadingFont} />
        <FontSelect label="正文字体" value={theme.bodyFont} onChange={theme.setBodyFont} />
        <div className="flex items-center justify-between gap-4 py-3">
          <p className="min-w-0 text-sm">圆角</p>
          <Select value={theme.radius} onValueChange={next => { if (next) theme.setRadius(next as Parameters<typeof theme.setRadius>[0]); }}>
            <SelectTrigger aria-label="圆角" className="w-40 shrink-0 sm:w-48">
              <SelectValue>{radius.label} · {radius.pixels}px</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" position="popper">
              <SelectGroup>
                {radii.map(({ value, label, pixels }) => <SelectItem key={value} value={value}>{label} · {pixels}px</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </CardContent></Card>
  );
}
