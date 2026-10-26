import type { CSSProperties } from "react";
import type { Editor } from "@tiptap/react";
import { calloutColors } from "../../src/import-layout";
import { updateCallout } from "../../src/rich-callout";
import { DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "../components/dropdown-menu";
import { richIcons } from "./rich-icons";

const labels = ["默认", "灰色", "棕色", "橙色", "黄色", "绿色", "蓝色", "紫色", "粉色", "红色"];
function swatch(value: string, attr: "textColor" | "color"): CSSProperties {
  const color = value === "default" ? "var(--color-text-primary)" : value === "brown" ? "color-mix(in oklab, var(--color-data-categorical-brown) 40%, var(--color-text-primary))" : `var(--color-text-${value})`;
  const background = value === "default" || attr === "textColor" ? "var(--color-background-body)" : value === "brown" ? "color-mix(in oklab, var(--color-data-categorical-brown) 12%, var(--color-background-card))" : `var(--color-background-${value})`;
  return { color, background };
}

export function CalloutColorsMenu({ editor, pos, onClose }: { editor: Editor; pos: number; onClose: () => void }) {
  const node = editor.state.doc.nodeAt(pos);
  return <DropdownMenuSub>
    <DropdownMenuSubTrigger><richIcons.Highlighter aria-hidden="true" /><span>颜色</span></DropdownMenuSubTrigger>
    <DropdownMenuSubContent sideOffset={6} alignOffset={-5} className="ui-rich-ui rich-block-menu rich-callout-colors" aria-label="标注颜色">
      {(["textColor", "color"] as const).map(attr => <DropdownMenuGroup key={attr}>
        <DropdownMenuLabel>{attr === "color" ? "背景颜色" : "文字颜色"}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={node?.attrs[attr] ?? "default"} onValueChange={value => { updateCallout(editor, pos, { [attr]: attr === "textColor" && value === "default" ? null : value }); onClose(); }}>
          {calloutColors.map((value, index) => <DropdownMenuRadioItem key={value} value={value}><span className="rich-callout-swatch flex size-5 shrink-0 items-center justify-center rounded-sm border border-border text-xs" aria-hidden="true" style={swatch(value, attr)}>{attr === "textColor" ? "A" : null}</span><span>{labels[index]}{attr === "color" ? "背景" : "文字"}</span></DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>)}
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}
