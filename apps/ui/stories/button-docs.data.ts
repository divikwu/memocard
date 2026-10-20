import type { Meta } from "@storybook/react-vite";
import type { Button } from "../src/components/ui/button";

// One Button-specific API definition for CSF Controls and the live Properties rows.
export const buttonArgTypes = {
  variant: { control: "select", options: ["default", "secondary", "outline", "ghost", "destructive", "link"], description: "生产按钮的视觉变体，不改变动作语义。", table: { type: { summary: '"default" | "secondary" | "outline" | "ghost" | "destructive" | "link"' }, defaultValue: { summary: '"default"' } } },
  size: { control: "select", options: ["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"], description: "文字或纯图标按钮的生产尺寸。", table: { type: { summary: '"xs" | "sm" | "default" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg"' }, defaultValue: { summary: '"default"' } } },
  children: { control: "text", description: "动作文字和可选装饰图标；Properties 参数预览在图标尺寸显示 Search，文字控件暂不可用。", table: { type: { summary: "React.ReactNode" }, defaultValue: { summary: "未设置" } } },
  disabled: { control: "boolean", description: "禁用原生按钮，阻止激活并跳过 Tab 顺序。", table: { type: { summary: "boolean" }, defaultValue: { summary: "false" } } },
  type: { control: "select", options: ["button", "submit", "reset"], description: "表单行为；默认渲染路径为 button，提交需显式设置 submit。", table: { type: { summary: '"button" | "submit" | "reset"' }, defaultValue: { summary: '"button"（默认渲染路径）' } } },
  onClick: { control: false, description: "原生点击回调，业务层处理动作；本页仅记录内存点击次数。", table: { type: { summary: "React.MouseEventHandler<HTMLButtonElement>" }, defaultValue: { summary: "未设置" } } },
  "aria-label": { control: "text", description: "纯图标按钮的可访问名称；Properties 参数预览留空时为图标提供“搜索”。", table: { type: { summary: "string" }, defaultValue: { summary: "未设置" } } },
  render: { control: false, description: "Base UI useRender 的元素或渲染函数；本页参数预览保留原生 button。", table: { type: { summary: "useRender.RenderProp" }, defaultValue: { summary: "未设置" } } },
} as const satisfies NonNullable<Meta<typeof Button>["argTypes"]>;

export type ButtonParameter = keyof typeof buttonArgTypes;
export const buttonParameters = Object.keys(buttonArgTypes) as ButtonParameter[];
