import { useState } from "react";
import { Button } from "./components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/dialog";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "./components/popover";
import { Slider } from "./components/slider";
import { Switch } from "./components/switch";
import "./elevation-showcase.css";

const scale = ["empty", "xxs", "xs", "sm", "md", "sr", "doc", "inner"] as const;

function ModePreview({ mode }: { mode: "light" | "dark" }) {
  const label = mode === "light" ? "浅色" : "深色";
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  return <section className="ui-theme elevation-mode" data-ui-theme={mode} aria-label={`${label}阴影预览`}>
    <header className="elevation-mode-header"><h2>{label}</h2><code>{mode}</code></header>
    <div className="elevation-scale" aria-label={`${label}八档基础阴影`}>
      {scale.map(name => <figure key={name}>
        <div className="elevation-scale-sample" data-shadow-scale={name} style={{ boxShadow: `var(--shadow-scale-${name})` }} aria-hidden="true" />
        <figcaption><code>{name}</code></figcaption>
      </figure>)}
    </div>
    <div className="elevation-component-examples">
      <section className="elevation-example">
        <h3>小控件 <code>control · xxs + inner</code></h3>
        <div className="elevation-controls"><label><Switch defaultChecked aria-label={`${label}自动保存`} /><span>自动保存</span></label><Slider defaultValue={[60]} aria-label={`${label}预览比例`} /></div>
      </section>
      <section className="elevation-example">
        <h3>内容卡片 <code>med · sm</code></h3>
        <Card size="sm" data-shadow-role="card"><CardHeader><CardTitle>让想法有一个落点</CardTitle><CardDescription>记录、整理，再回到值得保留的内容。</CardDescription></CardHeader><CardContent>共享实际 Card 的表面、边框与投影。</CardContent></Card>
      </section>
      <section className="elevation-example">
        <h3>笔记卡片 <code>empty → card-hover</code></h3>
        <Card size="sm" className="elevation-note-card" data-shadow-role="note-card"><CardHeader><CardTitle>今天的小发现</CardTitle><CardDescription>默认平面；悬停或聚焦时抬起。</CardDescription></CardHeader><CardContent><Button variant="ghost" size="sm">打开笔记</Button></CardContent></Card>
      </section>
      <section className="elevation-example">
        <h3>悬浮工具条 <code>floating · sr</code></h3>
        <div className="elevation-toolbar shadow-floating" role="toolbar" aria-label={`${label}文本格式`} data-shadow-role="floating"><Button size="sm" variant="ghost" aria-pressed={bold} onClick={() => setBold(value => !value)}>加粗</Button><Button size="sm" variant="ghost" aria-pressed={italic} onClick={() => setItalic(value => !value)}>斜体</Button><span aria-hidden="true">|</span><Button size="sm" variant="ghost" onClick={() => { setBold(false); setItalic(false); }}>清除格式</Button></div>
      </section>
      <section className="elevation-example">
        <h3>菜单与弹层 <code>high · md</code></h3>
        <div className="elevation-floating-surface surface-floating" data-shadow-role="popup"><strong>浮层轮廓</strong><p>{mode === "dark" ? "黑色 12% 外缘 + 白色 4% 内缘；保留 1px 布局边框。" : "沿用现有浅色边框与减淡后的投影。"}</p></div>
        <Popover><PopoverTrigger render={<Button variant="outline" />} aria-label={`${label}打开弹层`}>打开 Popover</PopoverTrigger><PopoverContent className="ui-theme" data-ui-theme={mode} data-testid={`elevation-popover-${mode}`}><PopoverTitle>整理这条笔记</PopoverTitle><PopoverDescription>实际 Popover 组件，使用 high 投影；深色采用黑色 12% 外缘与白色 4% 内缘。</PopoverDescription><Button variant="secondary" size="sm">添加到收藏</Button></PopoverContent></Popover>
      </section>
      <section className="elevation-example">
        <h3>文档表面 <code>document · doc</code></h3>
        <article className="elevation-document shadow-document" data-shadow-role="document"><p className="elevation-document-date">2026 年 10 月 27 日</p><h4>把零散的观察串起来</h4><p>记录身边的小事，留下可以重新理解它们的线索。</p></article>
        <Dialog><DialogTrigger render={<Button variant="outline" />} aria-label={`${label}打开文档预览`}>打开文档预览</DialogTrigger><DialogContent className="ui-theme elevation-document-dialog" data-ui-theme={mode} data-testid={`elevation-document-${mode}`}><DialogHeader><DialogTitle>把零散的观察串起来</DialogTitle><DialogDescription>独立文档预览使用 document，普通全屏编辑区保持平面。</DialogDescription></DialogHeader><p>记录身边的小事，留下可以重新理解它们的线索。</p></DialogContent></Dialog>
      </section>
    </div>
  </section>;
}

export function ElevationShowcase() {
  return <main className="elevation-showcase"><header><h1>阴影与组件</h1><p>八档标尺与实际组件的浅深色对照。示例仅使用本地内容。</p></header><div className="elevation-modes"><ModePreview mode="light" /><ModePreview mode="dark" /></div></main>;
}
