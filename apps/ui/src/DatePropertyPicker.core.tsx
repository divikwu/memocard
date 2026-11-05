import type { ComponentType, ComponentProps } from "react";
import { useId, useRef, useState } from 'react';
import { zhCN } from 'react-day-picker/locale/zh-CN';
import { formatPropertyDate, parsePropertyDate, propertyDateString, validPropertyDate } from './property-dates';

type View = {
  DayPicker: ComponentType<ComponentProps<typeof import("react-day-picker")["DayPicker"]>>;
  Button: ComponentType<Omit<ComponentProps<typeof import("@ui/components/button")["Button"]>, "render">>;
  Input: ComponentType<ComponentProps<typeof import("@ui/components/input")["Input"]>>;
};

export function createDatePropertyPicker(view: View) {
  const { DayPicker, Button, Input } = view;
function parseInputDate(value:string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? parsePropertyDate(`${match[3]}-${match[1]}-${match[2]}`) : undefined;
}
function DatePropertyPicker({value, busy, autoFocus, onChange, onSelect}: {value:string; busy:boolean; autoFocus:boolean; onChange:(value:string)=>void; onSelect:(value:string)=>void}) {
  const selected = parsePropertyDate(value);
  const [inputValue,setInputValue] = useState(formatPropertyDate(value.slice(0,10)));
  const [storedTimeSuffix] = useState(() => selected ? value.slice(10) : '');
  const [month,setMonth] = useState(selected ?? new Date());
  const [invalid,setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  function dateValue(date:Date) {
    return propertyDateString(date) + storedTimeSuffix;
  }
  function validate(value:string) {
    const valid = !value || Boolean(parseInputDate(value));
    setInvalid(!valid);
    return valid;
  }
  function choose(date:Date) {
    input.current?.setCustomValidity(''); setInvalid(false);
    setInputValue(formatPropertyDate(propertyDateString(date)));
    const next = dateValue(date);
    if (validPropertyDate(next)) onSelect(next);
  }
  return <fieldset disabled={busy} className="note-date-picker">
    <Input ref={input} autoFocus={autoFocus} aria-label="属性值" aria-describedby={invalid ? errorId : undefined} aria-invalid={invalid || undefined} value={inputValue} placeholder="MM/DD/YYYY" autoComplete="off" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" onInvalid={() => setInvalid(true)} onBlur={event => { validate(event.currentTarget.value); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (validate(event.currentTarget.value)) { const date = parseInputDate(event.currentTarget.value); if (date) choose(date); else onSelect(''); } } }} onChange={event => {
      const next = event.target.value, date = parseInputDate(next);
      event.currentTarget.setCustomValidity(!next || date ? '' : '请输入有效日期（MM/DD/YYYY）。');
      setInputValue(next); setInvalid(false);
      if (!next || date) onChange(date ? dateValue(date) : '');
      if (date) setMonth(date);
    }} />
    {invalid && <p id={errorId} role="alert" className="text-xs text-error">请输入有效日期（MM/DD/YYYY）。</p>}
    <DayPicker mode="single" required selected={selected} month={month} onMonthChange={setMonth} onSelect={choose} disabled={busy} locale={zhCN} weekStartsOn={0} showOutsideDays fixedWeeks labels={{labelPrevious:()=> '上个月',labelNext:()=> '下个月',labelDayButton:date=>`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`}} formatters={{formatCaption:date=>`${date.getFullYear()}年${date.getMonth()+1}月`,formatWeekdayName:date=>['日','一','二','三','四','五','六'][date.getDay()]}} />
    <Button type="button" variant="secondary" size="sm" className="note-date-today" disabled={busy} onClick={() => choose(new Date())}>今天</Button>
  </fieldset>;
}

  return DatePropertyPicker;
}
