import { createRoot } from 'react-dom/client';
import { ArrowRight, Bot, CircleAlert, Inbox, ShieldCheck } from 'lucide-react';
import { Card, CardDescription, CardFooter, CardHeader } from '../src/components/ui/card';
import { previewPages } from './pages';
import './styles.css';

function Home(){
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2.5"><img src="/favicon.png" alt="" className="size-8 shrink-0 object-contain" /><span className="font-semibold">MemoCard</span></div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="纯模拟数据，不连接真实笔记库"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />模拟数据<span className="hidden sm:inline">· 不连接真实笔记库</span></span>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8 sm:py-12">
      <div className="space-y-2"><h1 className="text-balance text-2xl font-semibold">UI 验收</h1><p className="text-pretty text-sm text-muted-foreground">选择状态，检查界面和操作。</p></div>
      <nav aria-label="验收页面" className="grid gap-4 sm:grid-cols-2">
        {previewPages.map(page=>{
          const Icon=page.file === 'empty.html'?Inbox:CircleAlert;
          return <a key={page.file} href={`/preview/${page.file}`} aria-label={`${page.title}，${page.scenarios.length} 个场景`} className="group block min-w-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Card className="h-full gap-3 py-4 group-hover:bg-hover">
              <CardHeader className="gap-3 px-4">
                <div className="flex items-center gap-2"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon aria-hidden="true" className="size-5 text-muted-foreground" /></span><h2 className="text-balance text-base font-semibold">{page.title}</h2><span className="ml-auto shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">{page.scenarios.length} 个场景</span></div>
                <CardDescription className="text-pretty leading-relaxed">{page.description}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto justify-between border-t px-4 text-sm font-medium [.border-t]:pt-3"><span>开始验收</span><ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" /></CardFooter>
            </Card>
          </a>;
        })}
        <a href="/preview/mascots.html" aria-label="吉祥物，13 个角色" className="group block min-w-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Card className="h-full gap-3 py-4 group-hover:bg-hover">
            <CardHeader className="gap-3 px-4">
              <div className="flex items-center gap-2"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Bot aria-hidden="true" className="size-5 text-muted-foreground" /></span><h2 className="text-balance text-base font-semibold">吉祥物</h2><span className="ml-auto shrink-0 rounded-md bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">13 个角色</span></div>
              <CardDescription className="text-pretty leading-relaxed">预览 MemoCard 与机器人角色的鼠标跟随和点击反应。</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto justify-between border-t px-4 text-sm font-medium [.border-t]:pt-3"><span>打开预览</span><ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" /></CardFooter>
          </Card>
        </a>
      </nav>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Home />);
