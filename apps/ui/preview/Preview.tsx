import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, House, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '../src/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../src/components/ui/select';
import { noteId } from './catalog';
import { previewPages } from './pages';
import './styles.css';

const page=previewPages.find(item=>window.location.pathname.endsWith(`/${item.file}`)) ?? previewPages[0];
const scenarios=page.scenarios;
const scenarioItems=scenarios.map((item,index)=>({value:String(index),label:`${String(index+1).padStart(2,'0')} · ${item.label}`}));
const scenarioGroups=[...new Set(scenarios.map(item=>item.group))];
const widthItems=[{value:'desktop',label:'桌面'},{value:'mobile',label:'窄屏 · 375px'}];

function Preview(){
  const [index,setIndex]=useState(0);
  const [revision,setRevision]=useState(0);
  const [width,setWidth]=useState('desktop');
  const current=scenarios[index];
  const settings=['theme-storage-error','font-error'].includes(current.id);
  const route=settings?'#/settings':current.detail?`#/notes/${noteId}`:'#/notes';
  return <main className="flex h-dvh flex-col bg-body text-primary">
    <header className="space-y-3 border-b p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Button variant="ghost" size="icon-sm" render={<a href="/preview/" aria-label="返回验收主页" title="返回验收主页" />}><House /></Button><h1 className="text-balance text-lg font-semibold">MemoCard · {page.title}验收</h1></div><span className="flex items-center gap-1.5 text-xs text-secondary"><ShieldCheck className="size-4" />纯模拟数据，不连接真实笔记库</span></div>
      <div className="flex flex-wrap items-center gap-2">
        <Select items={scenarioItems} value={String(index)} onValueChange={value=>{if(value !== null)setIndex(Number(value));}}>
          <SelectTrigger id="scenario" aria-label="验收场景" size="sm" className="w-full min-w-0 sm:w-80" title={scenarioItems[index].label}><SelectValue className="min-w-0 flex-1 text-left"><span className="truncate">{scenarioItems[index].label}</span></SelectValue></SelectTrigger>
          <SelectContent align="start" className="max-h-[min(24rem,var(--available-height))] w-80 max-w-[calc(100vw-2rem)]">
            {scenarioGroups.map(group=><SelectGroup key={group}><SelectLabel>{group}</SelectLabel>{scenarios.map((item,i)=>item.group === group?<SelectItem key={item.id} value={String(i)}>{scenarioItems[i].label}</SelectItem>:null)}</SelectGroup>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="上一项" title="上一项" disabled={index === 0} onClick={()=>setIndex(index-1)}><ArrowLeft /></Button><Button variant="outline" size="icon-sm" aria-label="下一项" title="下一项" disabled={index === scenarios.length-1} onClick={()=>setIndex(index+1)}><ArrowRight /></Button><Button variant="ghost" size="icon-sm" aria-label="重置场景" title="重置场景" onClick={()=>setRevision(revision+1)}><RotateCcw /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Select items={widthItems} value={width} onValueChange={value=>{if(value !== null)setWidth(value);}}>
            <SelectTrigger id="preview-width" aria-label="预览尺寸" size="sm" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent align="start"><SelectItem value="desktop">桌面</SelectItem><SelectItem value="mobile">窄屏 · 375px</SelectItem></SelectContent>
          </Select>
          <span className="text-xs tabular-nums text-secondary">{index+1} / {scenarios.length}</span>
        </div>
      </div>
      <p className="text-pretty text-sm">{current.instructions}</p>{current.note && <p className="text-pretty text-xs text-secondary">{current.note}</p>}
    </header>
    <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3"><iframe key={`${current.id}:${revision}:${width}`} title={`模拟场景：${current.label}`} className="mx-auto h-full min-h-96 max-w-full rounded-lg border bg-body" style={{width:width === 'mobile'?375:'100%'}} sandbox="allow-scripts allow-same-origin allow-modals" src={`/preview/client.html?scenario=${current.id}${route}`} /></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
