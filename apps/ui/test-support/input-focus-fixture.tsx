import { useRef } from "react";
import "../ui/business/rich-editor.css";
import { Input } from "../ui/components/input";
import { Textarea } from "../ui/components/textarea";
import { InputGroup, InputGroupInput, InputGroupTextarea } from "../ui/components/input-group";
import { NativeSelect } from "../ui/components/native-select";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/components/select";
import { Combobox, ComboboxInput, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxList, ComboboxItem } from "../ui/components/combobox";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "../ui/components/dialog";
import { Button } from "../ui/components/button";
import { Checkbox } from "../ui/components/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/components/radio-group";
import { Switch } from "../ui/components/switch";
import { Toggle } from "../ui/components/toggle";
import { Slider } from "../ui/components/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/components/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/components/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../ui/components/dropdown-menu";

const options = ["设计", "开发"];
export function InputFocusFixture({ mode }: { mode: "light" | "dark" }) {
  const popup = useRef<HTMLInputElement>(null);
  const id = (name: string) => `${mode}-focus-${name}`;
  return <section className="ui-theme grid gap-4 rounded-container border border-border p-6" data-ui-theme={mode} aria-label={`${mode} 输入焦点`}>
    <h2 className="text-xl">{mode === "light" ? "浅色" : "深色"}</h2>
    <Button variant="outline">键盘导航起点</Button>
    <label htmlFor={id("text")}>单行输入</label><Input id={id("text")} />
    <label htmlFor={id("password")}>密码</label><Input id={id("password")} type="password" autoComplete="new-password" />
    <label htmlFor={id("area")}>多行输入</label><Textarea id={id("area")} />
    <label htmlFor={id("group")}>复合输入</label><InputGroup><InputGroupInput id={id("group")} /></InputGroup>
    <label htmlFor={id("group-area")}>复合多行</label><InputGroup><InputGroupTextarea id={id("group-area")} /></InputGroup>
    <label htmlFor={id("native")}>原生选择</label><NativeSelect id={id("native")}><option>设计</option><option>开发</option></NativeSelect>
    <label htmlFor={id("select")}>选择器</label><Select defaultValue="设计"><SelectTrigger id={id("select")}><SelectValue /></SelectTrigger><SelectContent className="ui-theme" data-ui-theme={mode}><SelectItem value="设计">设计</SelectItem><SelectItem value="开发">开发</SelectItem></SelectContent></Select>
    <label htmlFor={id("setting-select")}>设置选择器</label><Select defaultValue="设计"><SelectTrigger id={id("setting-select")}><SelectValue /></SelectTrigger><SelectContent alignItemWithTrigger={false} className="ui-theme" data-ui-theme={mode}><SelectItem value="设计">设计</SelectItem><SelectItem value="开发">开发</SelectItem></SelectContent></Select>
    <label htmlFor={id("combo")}>搜索选择</label><Combobox items={options}><ComboboxInput id={id("combo")} /><ComboboxContent className="ui-theme" data-ui-theme={mode}><ComboboxList>{item => <ComboboxItem key={String(item)} value={item}>{String(item)}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>
    <label htmlFor={id("chips")}>多选输入</label><Combobox multiple items={options}><ComboboxChips><ComboboxChipsInput id={id("chips")} /></ComboboxChips><ComboboxContent className="ui-theme" data-ui-theme={mode}><ComboboxList>{item => <ComboboxItem key={String(item)} value={item}>{String(item)}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>
    <div className="ui-rich-ui rich-insert-search"><label htmlFor={id("raw")}>编辑器搜索</label><input id={id("raw")} /></div>
    <span id={id("editable-label")}>富文本输入</span><div contentEditable role="textbox" aria-labelledby={id("editable-label")} className="ui-rich-ui rich-editor-content rounded-textarea bg-control p-3" />
    <label htmlFor={id("invalid")}>无效输入</label><Input id={id("invalid")} aria-invalid="true" aria-describedby={id("error")} defaultValue="需要修正" /><p id={id("error")} className="text-sm text-error">请检查输入内容。</p>
    <Dialog><DialogTrigger render={<Button variant="outline" />}>打开自动聚焦输入</DialogTrigger><DialogContent initialFocus={popup} className="ui-theme" data-ui-theme={mode}><DialogTitle>输入焦点弹窗</DialogTitle><DialogDescription>根据打开方式保留鼠标或键盘焦点反馈。</DialogDescription><label htmlFor={id("popup")}>弹窗输入</label><Input id={id("popup")} ref={popup} /></DialogContent></Dialog>
    <button type="button" tabIndex={0}>原生按钮</button><a href={`#${id("link")}`} id={id("link")} tabIndex={0}>示例链接</a>
    <Checkbox aria-label="复选框" /><Switch aria-label="开关" />
    <RadioGroup defaultValue="a" aria-label="单选组"><RadioGroupItem value="a" aria-label="第一个单选项" /><RadioGroupItem value="b" aria-label="第二个单选项" /></RadioGroup>
    <Toggle aria-label="切换按钮">切换按钮</Toggle><Slider defaultValue={[50]} aria-label="调整值" />
    <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">第一个标签</TabsTrigger><TabsTrigger value="b">第二个标签</TabsTrigger></TabsList><TabsContent value="a">标签内容</TabsContent><TabsContent value="b">其他内容</TabsContent></Tabs>
    <Accordion><AccordionItem value="a"><AccordionTrigger>折叠控件</AccordionTrigger><AccordionContent>折叠内容</AccordionContent></AccordionItem></Accordion>
    <details><summary tabIndex={0}>原生折叠</summary><p>说明内容</p></details>
    <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}>打开菜单</DropdownMenuTrigger><DropdownMenuContent className="ui-theme" data-ui-theme={mode}><DropdownMenuItem>菜单选项</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </section>;
}
