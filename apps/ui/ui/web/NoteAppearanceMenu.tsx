import TextSmallcapsIcon from "@hugeicons/core-free-icons/TextSmallcapsIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "../components/dropdown-menu";
import { getPreviewFont } from "../preview-fonts";
import { noteFontChoices, type NoteFont, type useNoteAppearance } from "./note-appearance";

function FontChoices({ label, value, onChange }: { label: string; value: NoteFont; onChange: (font: NoteFont) => void }) {
  return <DropdownMenuRadioGroup className="grid grid-cols-3 gap-1 p-1" value={value} onValueChange={next => onChange(next as NoteFont)}>
    <DropdownMenuLabel className="col-span-full p-1">{label}</DropdownMenuLabel>
    {noteFontChoices.map(choice => <DropdownMenuRadioItem key={choice.value} value={choice.value} closeOnClick={false} className="web-note-font-choice flex-col gap-2 px-1 py-3 text-xs">
      <span className="text-2xl leading-none" aria-hidden="true" style={{ fontFamily: getPreviewFont(choice.value).fontFamily }}>Ag</span>
      {choice.label}
    </DropdownMenuRadioItem>)}
  </DropdownMenuRadioGroup>;
}

export function NoteAppearanceMenu({ appearance }: { appearance: ReturnType<typeof useNoteAppearance> }) {
  const { value, save, error } = appearance;
  return <>
      <FontChoices label="标题字体" value={value.headingFont} onChange={headingFont => save({ headingFont })} />
      <FontChoices label="正文字体" value={value.bodyFont} onChange={bodyFont => save({ bodyFont })} />
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked={value.smallText} onCheckedChange={checked => save({ size: checked ? "14" : "16" })} closeOnClick={false} aria-description="开启为 14 px，关闭为 16 px" className="web-note-small-text group/small-text pr-2">
        <HugeiconsIcon icon={TextSmallcapsIcon} strokeWidth={2} aria-hidden="true" />小字号
        <span aria-hidden="true" className="ml-auto flex h-5 w-9 shrink-0 items-center rounded-full bg-track p-0.5 group-data-checked/small-text:bg-accent-bg">
          <span className="size-4 rounded-full bg-switch-unchecked shadow-control transition-transform duration-fast-min ease-standard group-data-checked/small-text:translate-x-4 group-data-checked/small-text:bg-switch-checked" />
        </span>
      </DropdownMenuCheckboxItem>
      {error && <p className="px-2 py-1.5 text-xs text-error" role="status">无法保存此笔记的外观设置。</p>}
  </>;
}
