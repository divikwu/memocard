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
    <label htmlFor={id("combo")}>搜索选择</label><Combobox items={options}><ComboboxInput id={id("combo")} /><ComboboxContent className="ui-theme" data-ui-theme={mode}><ComboboxList>{item => <ComboboxItem key={String(item)} value={item}>{String(item)}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>
    <label htmlFor={id("chips")}>多选输入</label><Combobox multiple items={options}><ComboboxChips><ComboboxChipsInput id={id("chips")} /></ComboboxChips><ComboboxContent className="ui-theme" data-ui-theme={mode}><ComboboxList>{item => <ComboboxItem key={String(item)} value={item}>{String(item)}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>
    <div className="ui-rich-ui rich-insert-search"><label htmlFor={id("raw")}>编辑器搜索</label><input id={id("raw")} /></div>
    <span id={id("editable-label")}>富文本输入</span><div contentEditable role="textbox" aria-labelledby={id("editable-label")} className="ui-rich-ui rich-editor-content rounded-textarea bg-control p-3" />
    <label htmlFor={id("invalid")}>无效输入</label><Input id={id("invalid")} aria-invalid="true" aria-describedby={id("error")} defaultValue="需要修正" /><p id={id("error")} className="text-sm text-error">请检查输入内容。</p>
    <Dialog><DialogTrigger render={<Button variant="outline" />}>打开自动聚焦输入</DialogTrigger><DialogContent initialFocus={popup} className="ui-theme" data-ui-theme={mode}><DialogTitle>输入焦点弹窗</DialogTitle><DialogDescription>根据打开方式保留鼠标或键盘焦点反馈。</DialogDescription><label htmlFor={id("popup")}>弹窗输入</label><Input id={id("popup")} ref={popup} /></DialogContent></Dialog>
  </section>;
}
