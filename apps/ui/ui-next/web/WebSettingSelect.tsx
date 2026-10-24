import type { Ref } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/select";

export function WebSettingSelect<Value extends string>({ id, value, options, onValueChange, ref }: {
  id: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onValueChange: (value: Value) => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return <Select items={options} value={value} onValueChange={next => { if (next !== null) onValueChange(next); }}>
    <SelectTrigger id={id} ref={ref}><SelectValue /></SelectTrigger>
    <SelectContent align="end" alignItemWithTrigger={false}>
      {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
