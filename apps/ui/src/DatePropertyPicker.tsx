import { useId, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { zhCN } from 'react-day-picker/locale/zh-CN';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const propertyDateString = (date:Date) => `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function parsePropertyDate(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && propertyDateString(date) === value ? date : undefined;
}
export default function DatePropertyPicker({value, busy, autoFocus, onChange, onSelect}: {value:string; busy:boolean; autoFocus:boolean; onChange:(value:string)=>void; onSelect:(value:string)=>void}) {
  const selected = parsePropertyDate(value);
  const [month,setMonth] = useState(selected ?? new Date());
  const [invalid,setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  function choose(date:Date) {
    input.current?.setCustomValidity(''); setInvalid(false);
    onSelect(propertyDateString(date));
  }
  return <fieldset disabled={busy} className="note-date-picker">
    <Input ref={input} autoFocus={autoFocus} aria-label="属性值" aria-describedby={invalid ? errorId : undefined} aria-invalid={invalid || undefined} value={value} placeholder="YYYY-MM-DD" autoComplete="off" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" onInvalid={() => setInvalid(true)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} onChange={event => {
      const next = event.target.value, date = parsePropertyDate(next);
      event.currentTarget.setCustomValidity(!next || date ? '' : '请输入有效日期（YYYY-MM-DD）。');
      setInvalid(false); onChange(next); if (date) setMonth(date);
    }} />
    {invalid && <p id={errorId} role="alert" className="text-sm text-destructive">请输入有效日期（YYYY-MM-DD）。</p>}
    <DayPicker mode="single" required selected={selected} month={month} onMonthChange={setMonth} onSelect={choose} disabled={busy} locale={zhCN} weekStartsOn={0} showOutsideDays fixedWeeks labels={{labelPrevious:()=> '上个月',labelNext:()=> '下个月',labelDayButton:date=>`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`}} formatters={{formatCaption:date=>`${date.getFullYear()}年${date.getMonth()+1}月`,formatWeekdayName:date=>['日','一','二','三','四','五','六'][date.getDay()]}} />
    <Button type="button" variant="secondary" size="sm" className="note-date-today" disabled={busy} onClick={() => choose(new Date())}>今天</Button>
  </fieldset>;
}
