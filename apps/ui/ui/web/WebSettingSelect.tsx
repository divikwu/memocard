import type { Ref } from "react";
import { Label } from "../components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/select";

export function WebSettingSelect<Value extends string>({ id, label, value, options, onValueChange, ref }: {
  id: string;
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onValueChange: (value: Value) => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return <div className="web-setting-list-row">
    <Label className="web-setting-list-label" htmlFor={id}>{label}</Label>
    <Select items={options} value={value} onValueChange={next => { if (next !== null) onValueChange(next); }}>
      <SelectTrigger id={id} ref={ref} className="web-setting-list-trigger"><SelectValue className="web-setting-list-value" /></SelectTrigger>
      <SelectContent className="web-setting-select-content" align="end" alignItemWithTrigger={false}>
        {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
