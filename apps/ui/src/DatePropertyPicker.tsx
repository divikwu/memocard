import { useId, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { zhCN } from 'react-day-picker/locale/zh-CN';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPropertyDate, parsePropertyDate, propertyDateString, propertyDateTime, validPropertyDate } from './property-dates';
import { Switch } from '@/components/ui/switch';
import './date-property-picker.css';

function parseInputDate(value:string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? parsePropertyDate(`${match[3]}-${match[1]}-${match[2]}`) : undefined;
}
export default function DatePropertyPicker({value, busy, autoFocus, onChange, onSelect}: {value:string; busy:boolean; autoFocus:boolean; onChange:(value:string)=>void; onSelect:(value:string)=>void}) {
  const selected = parsePropertyDate(value);
  const [inputValue,setInputValue] = useState(formatPropertyDate(value.slice(0,10)));
  const [includeTime,setIncludeTime] = useState(value.includes('T'));
  const [time,setTime] = useState(value.match(/T([^Z+]+?)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '00:00');
  const [month,setMonth] = useState(selected ?? new Date());
  const [invalid,setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const timeId = useId();
  function combined(date:Date, enabled = includeTime, nextTime = time) {
    const day = propertyDateString(date);
    return enabled ? propertyDateTime(day,nextTime,value) : day;
  }
  function changeTime(next:string) {
    setTime(next);
    const date = parseInputDate(inputValue);
    if (date && next) onChange(combined(date,true,next));
  }
  function validate(value:string) {
    const valid = !value || Boolean(parseInputDate(value));
    setInvalid(!valid);
    return valid;
  }
  function choose(date:Date) {
    input.current?.setCustomValidity(''); setInvalid(false);
    setInputValue(formatPropertyDate(propertyDateString(date)));
    const next = combined(date);
    if (validPropertyDate(next)) onSelect(next);
  }
  return <fieldset disabled={busy} className="note-date-picker">
    <Input ref={input} autoFocus={autoFocus} aria-label="属性值" aria-describedby={invalid ? errorId : undefined} aria-invalid={invalid || undefined} value={inputValue} placeholder="MM/DD/YYYY" autoComplete="off" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" onInvalid={() => setInvalid(true)} onBlur={event => { validate(event.currentTarget.value); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (validate(event.currentTarget.value)) { const date = parseInputDate(event.currentTarget.value); if (date) choose(date); else onSelect(''); } } }} onChange={event => {
      const next = event.target.value, date = parseInputDate(next);
      event.currentTarget.setCustomValidity(!next || date ? '' : '请输入有效日期（MM/DD/YYYY）。');
      setInputValue(next); setInvalid(false);
      if (!next || date) onChange(date ? combined(date) : '');
      if (date) setMonth(date);
    }} />
    {invalid && <p id={errorId} role="alert" className="my-1 text-xs text-destructive">请输入有效日期（MM/DD/YYYY）。</p>}
    <DayPicker mode="single" required selected={selected} month={month} onMonthChange={setMonth} onSelect={choose} disabled={busy} locale={zhCN} weekStartsOn={0} showOutsideDays fixedWeeks labels={{labelPrevious:()=> '上个月',labelNext:()=> '下个月',labelDayButton:date=>`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`}} formatters={{formatCaption:date=>`${date.getFullYear()}年${date.getMonth()+1}月`,formatWeekdayName:date=>['日','一','二','三','四','五','六'][date.getDay()]}} />
    <label className="note-date-time-option">包含时间<Switch checked={includeTime} onCheckedChange={enabled => {
      setIncludeTime(enabled);
      const date = parseInputDate(inputValue);
      if (date) onChange(combined(date,enabled));
    }} /></label>
    {includeTime && <><label className="note-date-time-option" htmlFor={timeId}>时间</label><Input id={timeId} aria-label="时间" className="note-date-time-input" type="time" step="0.001" required value={time} onInput={event => changeTime(event.currentTarget.value)} onChange={event => changeTime(event.currentTarget.value)} onKeyDown={event => {
      if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); const date = parseInputDate(inputValue); if (date && time && validPropertyDate(combined(date))) onSelect(combined(date)); }
    }} /></>}
    <Button type="button" variant="secondary" size="sm" className="note-date-today" disabled={busy} onClick={() => choose(new Date())}>今天</Button>
  </fieldset>;
}
