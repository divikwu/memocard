import { LumaShowcase } from "./LumaShowcase";
import { useId, useState, type ReactNode } from "react";
import { usePreviewMode } from "./preview-mode";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { Textarea } from "./components/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./components/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./components/sheet";
import { Switch } from "./components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/tooltip";
import "./luma-page.css";

export function ButtonExample() {
  const [count, setCount] = useState(0);
  const act = () => setCount(value => value + 1);
  return <>
    <div className="luma-control-row">
      <Button data-testid="luma-primary-button" onClick={act}>主要操作</Button>
      <Button variant="secondary" onClick={act}>次要操作</Button>
      <Button variant="outline" onClick={act}>边框操作</Button>
      <Button variant="ghost" onClick={act}>轻量操作</Button>
      <Button variant="destructive" onClick={act}>危险操作</Button>
      <Button variant="link" onClick={act}>链接操作</Button>
      <Button disabled>禁用操作</Button>
    </div>
    <p className="luma-status" role="status">{count ? `已触发 ${count} 次示例操作` : "可使用鼠标、Tab、Enter 和空格键操作。"}</p>
  </>;
}

export function InputExample() {
  const id = useId();
  return <div className="luma-field-grid">
    <div className="luma-field"><label htmlFor={`${id}-default`}>名称</label><Input id={`${id}-default`} data-testid="luma-input" placeholder="输入名称" autoComplete="off" /></div>
    <div className="luma-field"><label htmlFor={`${id}-error`}>电子邮箱</label><Input id={`${id}-error`} aria-invalid="true" aria-describedby={`${id}-error-message`} defaultValue="invalid-address" /><p id={`${id}-error-message`} className="luma-error">请输入完整的电子邮箱地址。</p></div>
    <div className="luma-field"><label htmlFor={`${id}-disabled`}>禁用输入</label><Input id={`${id}-disabled`} disabled placeholder="此项暂不可编辑" /></div>
  </div>;
}

export function TextareaExample() {
  const id = useId();
  return <div className="luma-field luma-field-wide"><label htmlFor={id}>说明</label><Textarea id={id} data-testid="luma-textarea" placeholder="输入一段说明，检查中文、英文和多行排版。" /></div>;
}

export function CardExample() {
  return <Card className="luma-example-card" data-testid="luma-card">
    <CardHeader><CardTitle>一套共同的设计语言</CardTitle><CardDescription>Shared theme · Luma · Base UI</CardDescription></CardHeader>
    <CardContent><p>组件使用 Astryx 语义角色，并从 Tailwind 基础色板取值。</p></CardContent>
    <CardFooter><span className="luma-secondary">默认 8px 圆角基准 · 支持明暗模式</span></CardFooter>
  </Card>;
}

export function DialogExample() {
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" data-testid="luma-dialog-trigger" />}>打开对话框</DialogTrigger>
    <DialogContent data-testid="luma-dialog-content">
      <DialogHeader><DialogTitle>对话框示例</DialogTitle><DialogDescription>检查遮罩、键盘焦点和关闭后的焦点返回。</DialogDescription></DialogHeader>
      <p>使用 Tab 在对话框内移动焦点，按 Escape 关闭。</p>
      <DialogFooter><DialogClose render={<Button variant="outline" />}>取消</DialogClose><DialogClose render={<Button />}>完成</DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function DropdownMenuExample() {
  const [action, setAction] = useState("尚未选择操作");
  const [details, setDetails] = useState(true);
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" data-testid="luma-menu-trigger" />}>打开菜单</DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-testid="luma-menu-content">
        <DropdownMenuItem onClick={() => setAction("已选择复制操作")}>复制</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setAction("已选择重命名操作")}>重命名</DropdownMenuItem>
        <DropdownMenuItem disabled>不可用操作</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={details} onCheckedChange={setDetails}>显示说明</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <p className="luma-status" role="status">{action} · {details ? "显示说明" : "隐藏说明"}</p>
  </>;
}

export function PopoverExample() {
  const id = useId();
  return <Popover>
    <PopoverTrigger render={<Button variant="outline" data-testid="luma-popover-trigger" />}>打开浮层</PopoverTrigger>
    <PopoverContent align="start" data-testid="luma-popover-content" aria-label="浮层示例">
      <div className="luma-field"><label htmlFor={id}>显示名称</label><Input id={id} placeholder="在浮层中输入" /><p className="luma-secondary">点击外部区域或按 Escape 关闭。</p></div>
    </PopoverContent>
  </Popover>;
}

const densityItems = [{ label: "舒适", value: "comfortable" }, { label: "紧凑", value: "compact" }, { label: "宽松", value: "relaxed" }];
export function SelectExample() {
  const id = useId();
  const [value, setValue] = useState("comfortable");
  return <div className="luma-field luma-field-narrow"><label htmlFor={id}>显示密度</label>
    <Select items={densityItems} value={value} onValueChange={next => setValue(next ?? "comfortable")}>
      <SelectTrigger id={id} data-testid="luma-select-trigger"><SelectValue /></SelectTrigger>
      <SelectContent data-testid="luma-select-content">{densityItems.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function SheetExample() {
  return <Sheet>
    <SheetTrigger render={<Button variant="outline" data-testid="luma-sheet-trigger" />}>打开侧面板</SheetTrigger>
    <SheetContent data-testid="luma-sheet-content">
      <SheetHeader><SheetTitle>侧面板示例</SheetTitle><SheetDescription>用于需要更多空间的辅助内容。</SheetDescription></SheetHeader>
      <p className="luma-sheet-copy">面板沿用 Luma 的布局与 Base UI 的焦点管理。</p>
      <SheetFooter><SheetClose render={<Button />}>关闭面板</SheetClose></SheetFooter>
    </SheetContent>
  </Sheet>;
}

export function SwitchExample() {
  const id = useId();
  const [checked, setChecked] = useState(true);
  return <div className="luma-switch-list">
    <div className="luma-switch-row"><Switch id={id} checked={checked} onCheckedChange={setChecked} data-testid="luma-switch" /><label htmlFor={id}>启用示例选项</label><span className="luma-secondary" role="status">{checked ? "已开启" : "已关闭"}</span></div>
    <div className="luma-switch-row"><Switch id={`${id}-disabled`} disabled /><label htmlFor={`${id}-disabled`}>禁用选项</label></div>
  </div>;
}

export function TabsExample() {
  return <Tabs defaultValue="overview" className="luma-example-tabs" data-testid="luma-tabs">
    <TabsList aria-label="组件信息"><TabsTrigger value="overview">概览</TabsTrigger><TabsTrigger value="details">详细信息</TabsTrigger><TabsTrigger value="disabled" disabled>不可用</TabsTrigger></TabsList>
    <TabsContent value="overview"><p>使用方向键在标签间移动，查看当前主题下的选中反馈。</p></TabsContent>
    <TabsContent value="details"><p data-testid="luma-tabs-details">主题：Luma；底座：Base UI；默认圆角基准：8px，可在工具栏切换。</p></TabsContent>
  </Tabs>;
}

export function TooltipExample() {
  return <TooltipProvider><Tooltip>
    <TooltipTrigger render={<Button variant="outline" data-testid="luma-tooltip-trigger" />}>查看提示</TooltipTrigger>
    <TooltipContent data-testid="luma-tooltip-content">悬停或键盘聚焦均可查看此提示。</TooltipContent>
  </Tooltip></TooltipProvider>;
}

export function LumaStoryFrame({ children }: { children: ReactNode }) {
  const mode = usePreviewMode();
  return <main className="ui-next-theme luma-story-frame" data-ui-theme={mode}>{children}</main>;
}

export function LumaPage() {
  return <LumaShowcase />;
}
