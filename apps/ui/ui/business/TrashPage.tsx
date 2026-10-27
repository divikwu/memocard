import { isIOSNative, useIOSSurface } from "../../src/ios-native";
import { useTrash, type TrashPageProps } from "../../src/hooks/use-trash";
import { errorMessage } from "../../src/error-messages";
import { Button } from "../components/button";
import { Card, CardContent } from "../components/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/empty";
import { Skeleton } from "../components/skeleton";
import { Spinner } from "../components/spinner";
import { DeleteIcon } from "../icons";
import { NoteMarkdown } from "./NoteMarkdown";
import { PageNotice } from "./PageNotice";
import "./trash.css";

const title = (item: { title?: string }) => item.title || "新内容";
const date = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "未知时间";

export function TrashPage(props: TrashPageProps) {
  const m = useTrash(props);
  const closePreview = () => { if (!m.pending.current) { m.readEpoch.current++; m.setSelected(null); } };
  useIOSSurface("delete-trash", () => ({
    kind: "alert", title: `永久删除「${m.deleteTarget ? title(m.deleteTarget) : ""}」？`, presented: m.deleteTarget !== null && !m.deleting,
    message: "此操作无法撤销，删除后无法从回收站恢复。图片附件会保留。", error: m.deleteError != null ? errorMessage(m.deleteError) : undefined,
    sections: [{ id: "confirm", actions: [{ id: "delete", title: "确认永久删除", destructive: true, disabled: m.deleting }] }],
  }), async action => { if (action === "delete") await m.permanentlyDelete(); else if (!m.pending.current) m.setDeleteTarget(null); });
  return <section className="ui-trash" aria-label="回收站"><header><h1>回收站</h1><Button ref={m.refreshButton} variant="outline" size="sm" aria-busy={m.loading} disabled={m.loading || m.busy} onClick={() => void m.load()}>{m.loading && m.data.notes.length > 0 && <Spinner aria-hidden="true" />}刷新回收站</Button></header>
    {m.error != null && <PageNotice title="回收站操作未完成">{errorMessage(m.error)}</PageNotice>}{m.notice && <p role="status">{m.notice}</p>}
    {m.data.issues.length > 0 && <PageNotice tone="info" title="部分回收记录无法读取">{m.data.issues.length} 条记录已保留，请检查回收目录后刷新。</PageNotice>}
    {m.loading && <div role="status" aria-label="正在读取回收站" className={m.data.notes.length ? "sr-only" : undefined}><span className="sr-only">正在读取回收站…</span>{!m.data.notes.length && <div className="ui-trash-list" aria-hidden="true">{[0, 1, 2].map(index => <Card key={index} className="ui-trash-card"><CardContent className="ui-trash-item"><div className="ui-trash-loading-content"><Skeleton className="h-5 w-40 max-w-full" /><Skeleton className="h-4 w-48 max-w-full" /><Skeleton className="h-4 w-36 max-w-full" /><Skeleton className="h-5 w-4/5" /></div><div className="ui-trash-actions"><Skeleton className="h-8 w-18" />{props.canPermanentlyDelete && <Skeleton className="h-8 w-24" />}</div></CardContent></Card>)}</div>}</div>}
    {!m.loading && !m.error && !m.data.notes.length && <Card className="py-0"><Empty className="ui-trash-empty"><EmptyHeader><EmptyMedia variant="icon"><DeleteIcon aria-hidden="true" /></EmptyMedia><EmptyTitle><h2>回收站是空的</h2></EmptyTitle><EmptyDescription>删除的笔记会保留在这里，随时恢复。</EmptyDescription></EmptyHeader></Empty></Card>}
    <div className="ui-trash-list" aria-busy={m.loading}>{m.data.notes.map(item => <Card key={item.trashKey} className="ui-trash-card"><CardContent className="ui-trash-item"><button type="button" className="ui-trash-open" disabled={m.busy} onClick={event => void m.open(item, event.currentTarget)} aria-label={`查看已删除笔记：${title(item)}`}><h2 title={title(item)}>{title(item)}</h2><p className="ui-trash-path" title={item.relativePath}>{item.relativePath}</p><p>删除于 <time dateTime={item.deletedAt}>{date(item.deletedAt)}</time></p>{item.preview && <p className="line-clamp-2">{item.preview}</p>}</button><div className="ui-trash-actions"><Button variant="outline" size="sm" disabled={m.busy} aria-label={`恢复笔记：${title(item)}`} onClick={() => void m.restore(item)}>{m.restoring === item.trashKey ? "正在恢复…" : "恢复"}</Button>{props.canPermanentlyDelete && <Button variant="ghost" size="sm" disabled={m.busy} aria-label={`永久删除笔记：${title(item)}`} onClick={event => { m.deleteFocus.current = event.currentTarget; m.setDeleteError(null); m.setDeleteTarget(item); }}><DeleteIcon aria-hidden="true" />永久删除</Button>}</div></CardContent></Card>)}</div>
    <Dialog open={!!m.selected} onOpenChange={open => { if (!open) closePreview(); }}><DialogContent className="ui-trash-preview" finalFocus={() => m.returnFocus.current?.isConnected ? m.returnFocus.current : m.refreshButton.current ?? true}><DialogHeader><DialogTitle>{m.selected ? title(m.selected) : "已删除笔记"}</DialogTitle><DialogDescription>{m.selected?.relativePath} · 此内容只读，恢复后可继续编辑。</DialogDescription></DialogHeader>{m.readError != null && <p role="alert" className="text-sm text-error">{errorMessage(m.readError)}</p>}<div className="ui-trash-preview-body">{m.reading ? <div role="status" aria-label="正在读取笔记"><Skeleton className="h-40" /></div> : m.preview && <NoteMarkdown body={m.preview.note.body} notePath={m.preview.note.relativePath} />}</div><DialogFooter><Button variant="outline" disabled={m.busy} onClick={closePreview}>关闭</Button><Button disabled={!m.preview || m.busy} onClick={() => { if (m.selected && m.preview) void m.restore(m.selected, m.preview.note.contentHash); }}>恢复笔记</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!m.deleteTarget && !isIOSNative} onOpenChange={open => { if (!open && !m.pending.current) m.setDeleteTarget(null); }}><DialogContent finalFocus={() => m.deleteFocus.current?.isConnected ? m.deleteFocus.current : m.refreshButton.current ?? true}><DialogHeader><DialogTitle>永久删除「{m.deleteTarget ? title(m.deleteTarget) : ""}」？</DialogTitle><DialogDescription>此操作无法撤销，删除后无法从回收站恢复。图片附件会保留。</DialogDescription></DialogHeader>{m.deleteError != null && <p role="alert" className="text-sm text-error">{errorMessage(m.deleteError)}</p>}<DialogFooter><Button variant="outline" autoFocus disabled={m.deleting} onClick={() => m.setDeleteTarget(null)}>取消</Button><Button variant="destructive" disabled={m.deleting} onClick={() => void m.permanentlyDelete()}>{m.deleting ? "正在删除…" : "确认永久删除"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
