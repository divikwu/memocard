import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import themeCSS from "../src/styles.css?raw";
import { IOS_PALETTE_KEYS, readIOSPalette } from "../src/lib/ios-palette";
import { tagColors } from "../src/tag-colors";
import "../src/tag-colors.css";

// Read role names from the production Tailwind mapping, without copying color values.
const theme = themeCSS.match(/@theme inline \{([\s\S]*?)\n\}/)![1];
const roles = [...theme.matchAll(/--color-([\w-]+):\s*var\((--[\w-]+)\)/g)]
  .map(([, name, variable]) => ({ name, variable }));

function Colors() {
  return <main className="max-w-5xl space-y-8 bg-background p-6 text-foreground">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">颜色与状态语义</h1><p className="text-sm text-muted-foreground">角色来自生产 CSS，明暗、强调色与中性色由现有 ThemeProvider 解析。颜色不是另一套静态色板。</p></header>
    <section className="space-y-3"><h2 className="text-lg font-semibold">界面语义色</h2><p className="text-sm text-muted-foreground">chart-*、emphasis 与 sidebar-primary 两组前景/背景目前保留定义，尚无生产消费者；目录展示不代表已接入。实际消费见 design/token-consumption.md。</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {roles.map(({ name, variable }) => <div key={name} className="overflow-hidden rounded-lg border">
        <div aria-label={`${name} 色样`} className="h-14" style={{ backgroundColor: `var(${variable})` }} />
        <div className="space-y-1 border-t p-2 text-xs"><code className="block break-all">{name}</code><span className="block break-all text-muted-foreground">{variable}</span></div>
      </div>)}
    </div></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">标签颜色</h2><p className="text-sm text-muted-foreground">前景与背景成对使用；同一组解析值也供 iOS 自定义内容区使用。</p><div className="flex flex-wrap gap-3">
      {tagColors.map(([id, label]) => <span key={id} aria-label={`${label}标签`} className="rounded-full px-3 py-1 text-sm" style={{ backgroundColor: `var(--tag-${id}-bg)`, color: `var(--tag-${id}-fg)` }}>{label}</span>)}
    </div></section>
  </main>;
}

const meta = {
  title: "foundations/colors", component: Colors, globals: desktopGlobals,
  parameters: { docs: { story: { height: "1600px" } } },
} satisfies Meta<typeof Colors>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const style = getComputedStyle(canvasElement.ownerDocument.documentElement);
    await expect(roles.length).toBeGreaterThan(0);
    for (const { name, variable } of roles) {
      await expect(style.getPropertyValue(variable).trim(), variable).not.toBe("");
      await expect(getComputedStyle(canvas.getByLabelText(`${name} 色样`)).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    }
    const palette = readIOSPalette();
    for (const key of IOS_PALETTE_KEYS) await expect(palette?.[key], key).toHaveLength(4);
    for (const [, label] of tagColors) await expect(canvas.getByLabelText(`${label}标签`)).toBeVisible();
  },
};
export const Dark: Story = { ...Default, globals: { theme: "dark" } };
