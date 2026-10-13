import { createRoot } from 'react-dom/client';
import { House } from 'lucide-react';
import { Mascot } from 'page-mascot';
import { Button } from '../src/components/ui/button';
import './styles.css';

const mascots=[
  {id:'memocard-final',name:'MemoCard · 最终版',description:'闭眼招手 · 铅笔与圆脚'},
  {id:'memocard-primary',name:'MemoCard',description:'记录与陪伴 · 铅笔与咖啡'},
  {id:'memocard-primary',name:'MemoCard · 渐隐版',description:'底部柔化 · 渐隐融入页面',fade:true},
  {id:'memocard-idea',name:'MemoCard · 带脚版',description:'灵感陪伴 · 铅笔与灯泡'},
  {id:'crt',name:'CRT',description:'复古显示器'},
  {id:'drone',name:'Drone',description:'紫色机器人'},
  {id:'gearbot',name:'Gearbot',description:'齿轮机器人'},
  {id:'knight',name:'Knight',description:'蓝羽骑士'},
  {id:'radio',name:'Radio',description:'复古收音机'},
  {id:'scout',name:'Scout',description:'侦察机器人'},
  {id:'toaster',name:'Toaster',description:'吐司机机器人'},
];

function Mascots(){
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-2 px-4 py-3 sm:px-8">
        <Button variant="ghost" size="icon-sm" render={<a href="/preview/" aria-label="返回验收主页" title="返回验收主页" />}><House /></Button>
        <span className="font-semibold">MemoCard · 吉祥物预览</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{mascots.length} 个角色</span>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8 sm:py-12">
      <div className="space-y-2"><h1 className="text-balance text-2xl font-semibold">吉祥物</h1><p className="text-pretty text-sm text-muted-foreground">移动鼠标，让角色跟着你转头；点击角色，看看它们的反应。</p><p className="text-pretty text-xs text-muted-foreground">点击会眨眼，出现爱心、闪光或开心表情，快速连点会转圈眼。</p></div>
      <ul aria-label="吉祥物角色" className="grid list-none grid-cols-2 gap-4 p-0 lg:grid-cols-4">
        {mascots.map(mascot=><li key={mascot.name} className="flex min-w-0 flex-col items-center gap-4 rounded-xl border py-6">
          <div className="relative isolate" style={mascot.fade?{maskImage:'linear-gradient(to bottom, black 76%, transparent 93%)',WebkitMaskImage:'linear-gradient(to bottom, black 76%, transparent 93%)'}:undefined}>
            <Mascot directions={`/preview/mascots/${mascot.id}-directions.webp`} reactions={`/preview/mascots/${mascot.id}-reactions.webp`} size={140} label={mascot.name} className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
            {mascot.fade&&<span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{backdropFilter:'blur(2.5px)',WebkitBackdropFilter:'blur(2.5px)',maskImage:'linear-gradient(to bottom, transparent 76%, black 93%)',WebkitMaskImage:'linear-gradient(to bottom, transparent 76%, black 93%)'}} />}
          </div>
          <div className="space-y-1 text-center"><h2 className="text-sm font-medium">{mascot.name}</h2><p className="text-xs text-muted-foreground">{mascot.description}</p></div>
        </li>)}
      </ul>
      <p className="text-pretty text-xs text-muted-foreground">交互与预设角色来自 <a href="https://koboyo.com/page-mascot" target="_blank" rel="noreferrer" className="underline underline-offset-4">page-mascot</a> · <a href="/preview/mascots/LICENSE.txt" className="underline underline-offset-4">MIT License</a></p>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Mascots />);
