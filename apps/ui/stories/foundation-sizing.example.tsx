import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../src/components/ui/input-group";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../src/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { Textarea } from "../src/components/ui/textarea";
import { buttonSizeExamples } from "./button-docs.data";

const selectItems = [{ value: "all", label: "全部" }, { value: "recent", label: "最近" }];

function SizeRow({ name, selector, square = false, children }: { name: string; selector?: string; square?: boolean; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState("");
  useLayoutEffect(() => {
    const element = (selector ? root.current!.querySelector(selector) : root.current!.firstElementChild) as HTMLElement;
    const round = (value: number) => Math.round(value * 100) / 100;
    const measure = () => {
      const box = element.getBoundingClientRect();
      const icon = element.querySelector("svg")?.getBoundingClientRect();
      setMetrics((square ? `${round(box.width)} × ${round(box.height)}px` : `${round(box.height)}px 高`) + (icon ? ` · 图标 ${round(icon.width)}px` : ""));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [selector, square]);
  return <tr data-density-name={name}><th scope="row"><code>{name}</code></th><td>
    <code data-density-metric>{metrics || "读取中…"}</code>
    <div ref={root} className="foundation-control-preview">{children}</div>
  </td></tr>;
}

export function ControlSizeRows() {
  return <>
    {buttonSizeExamples.map(({ size }) => <SizeRow key={size} name={`Button / ${size}`} square={size.startsWith("icon")}>
      <Button size={size} aria-label={size.startsWith("icon") ? "搜索" : undefined}>{size.startsWith("icon") ? <Search aria-hidden="true" /> : "保存"}</Button>
    </SizeRow>)}
    <SizeRow name="Input"><Input aria-label="尺寸预览标题" defaultValue="笔记标题" /></SizeRow>
    <SizeRow name="InputGroup"><InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="尺寸预览搜索" placeholder="搜索笔记…" /></InputGroup></SizeRow>
    {(["default", "sm"] as const).map(size => <SizeRow key={size} name={`Select / ${size}`}><Select items={selectItems} defaultValue="all"><SelectTrigger size={size} aria-label={`${size} 尺寸预览范围`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="recent">最近</SelectItem></SelectContent></Select></SizeRow>)}
    {(["default", "line"] as const).map(variant => <SizeRow key={variant} name={`Tabs / ${variant}`} selector='[data-slot="tabs-list"]'><Tabs defaultValue="notes"><TabsList variant={variant} aria-label={`${variant} 尺寸预览分类`}><TabsTrigger value="notes">笔记</TabsTrigger><TabsTrigger value="pinned">固定</TabsTrigger></TabsList></Tabs></SizeRow>)}
    <SizeRow name="Textarea"><Textarea aria-label="尺寸预览正文" defaultValue="写下笔记…" /></SizeRow>
  </>;
}
