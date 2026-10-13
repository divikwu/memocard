import { useId, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { zhCN } from 'react-day-picker/locale/zh-CN';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPropertyDate, parsePropertyDate, propertyDateString } from './property-dates';

function parseInputDate(value:string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? parsePropertyDate(`${match[3]}-${match[1]}-${match[2]}`) : undefined;
}
export default function DatePropertyPicker({value, busy, autoFocus, onChange, onSelect}: {value:string; busy:boolean; autoFocus:boolean; onChange:(value:string)=>void; onSelect:(value:string)=>void}) {
  const selected = parsePropertyDate(value);
  const [inputValue,setInputValue] = useState(formatPropertyDate(value));
  const [month,setMonth] = useState(selected ?? new Date());
  const [invalid,setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  function validate(value:string) {
    const valid = !value || Boolean(parseInputDate(value));
    setInvalid(!valid);
    return valid;
  }
  function choose(date:Date) {
    input.current?.setCustomValidity(''); setInvalid(false);
    setInputValue(formatPropertyDate(propertyDateString(date)));
    onSelect(propertyDateString(date));
  }
  return <fieldset disabled={busy} className="note-date-picker">
    <Input ref={input} autoFocus={autoFocus} aria-label="属性值" aria-describedby={invalid ? errorId : undefined} aria-invalid={invalid || undefined} value={inputValue} placeholder="MM/DD/YYYY" autoComplete="off" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" onInvalid={() => setInvalid(true)} onBlur={event => { validate(event.currentTarget.value); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (validate(event.currentTarget.value)) { const date = parseInputDate(event.currentTarget.value); onSelect(date ? propertyDateString(date) : ''); } } }} onChange={event => {
      const next = event.target.value, date = parseInputDate(next);
      event.currentTarget.setCustomValidity(!next || date ? '' : '请输入有效日期（MM/DD/YYYY）。');
      setInputValue(next); setInvalid(false);
      if (!next || date) onChange(date ? propertyDateString(date) : '');
      if (date) setMonth(date);
    }} />
    {invalid && <p id={errorId} role="alert" className="my-1 text-xs text-destructive">请输入有效日期（MM/DD/YYYY）。</p>}
    <DayPicker mode="single" required selected={selected} month={month} onMonthChange={setMonth} onSelect={choose} disabled={busy} locale={zhCN} weekStartsOn={0} showOutsideDays fixedWeeks labels={{labelPrevious:()=> '上个月',labelNext:()=> '下个月',labelDayButton:date=>`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`}} formatters={{formatCaption:date=>`${date.getFullYear()}年${date.getMonth()+1}月`,formatWeekdayName:date=>['日','一','二','三','四','五','六'][date.getDay()]}} />
    <Button type="button" variant="secondary" size="sm" className="note-date-today" disabled={busy} onClick={() => choose(new Date())}>今天</Button>
  </fieldset>;
}
