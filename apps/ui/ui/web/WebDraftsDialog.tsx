import { useRef } from "react";
import type { AppViewState } from "../../src/App";
import { errorMessage } from "../../src/error-messages";
import { PageNotice } from "../business/PageNotice";
import { Button } from "../components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/dialog";
import { DocumentIcon } from "../icons";
import "./WebDraftsDialog.css";

export function WebDraftsDialog({ state: s }: { state: AppViewState }) {
  const d = s.drafts;
  const deleteFocus = useRef<HTMLButtonElement | null>(null);
  const doneFocus = useRef<HTMLButtonElement | null>(null);
  const name = (draft: (typeof d.records)[number]) => draft.title || draft.body.slice(0, 80) || "空正文";
  return <><Dialog open={d.open} onOpenChange={d.onOpenChange}><DialogContent className="web-drafts-dialog"><DialogHeader><DialogTitle>保留的草稿</DialogTitle><DialogDescription>继续未完成的记录。关闭提醒会保留内容。</DialogDescription></DialogHeader>
    {d.error != null && <PageNotice title="草稿操作未完成">{errorMessage(d.error)}</PageNotice>}
    <div className="web-drafts-list">{d.records.length ? d.records.map(draft => <article key={`${draft.recoveryScope ?? (draft.unscoped ? "legacy" : "current")}:${draft.draftKey ?? draft.id}`}><DocumentIcon aria-hidden="true" /><div>
      <h3>{name(draft)}</h3>{draft.title && <p>{draft.body.slice(0, 120)}</p>}
      {draft.updatedAt && Number.isFinite(Date.parse(draft.updatedAt)) && <p><time dateTime={draft.updatedAt}>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(draft.updatedAt))}</time></p>}
      {draft.unscoped && <p className="text-warning">所属笔记库待确认</p>}
      {draft.pendingProperties?.length ? <p>未保存属性：{draft.pendingProperties.map(change => `${change.name}：${change.value === undefined ? "属性更改" : Array.isArray(change.value) ? change.value.join("、") : String(change.value)}`).join("；")}</p> : null}
      <div className="flex flex-wrap gap-2"><Button size="sm" aria-label={`继续编辑：${name(draft)}`} disabled={d.busy} onClick={() => void d.onResume(draft)}>继续编辑</Button>{draft.reminderDismissed ? <span className="text-sm text-secondary">已关闭提醒</span> : draft.unscoped && draft.draftKey && draft.revision && s.capabilities.has("dismissDraftReminder") && <Button size="sm" variant="ghost" disabled={d.busy} onClick={() => void d.onDismiss(draft)}>不再提醒</Button>}{draft.draftKey && draft.revision && s.status?.vaultId && s.capabilities.has("deleteDraft") && <Button size="sm" aria-label={`删除草稿：${name(draft)}`} variant="ghost" disabled={d.busy} onClick={event => { deleteFocus.current = event.currentTarget; d.onDelete(draft); }}>删除草稿</Button>}</div>
    </div></article>) : <p>暂无保留草稿。</p>}</div>
    <DialogFooter><Button variant="outline" disabled={d.busy} onClick={() => void d.onRefresh()}>刷新草稿</Button><Button ref={doneFocus} onClick={() => d.onOpenChange(false)} disabled={d.busy}>完成</Button></DialogFooter>
  </DialogContent></Dialog><Dialog open={!!d.deleteTarget} onOpenChange={open => { if (!open) d.onCancelDelete(); }}><DialogContent finalFocus={() => deleteFocus.current?.isConnected ? deleteFocus.current : doneFocus.current ?? true}><DialogHeader><DialogTitle>删除这条草稿？</DialogTitle><DialogDescription>草稿删除后无法恢复，已保存的笔记不受影响。</DialogDescription></DialogHeader><p>{d.deleteTarget ? name(d.deleteTarget) : "空正文"}</p><DialogFooter><Button variant="outline" autoFocus disabled={d.busy} onClick={d.onCancelDelete}>取消</Button><Button variant="destructive" disabled={d.busy} onClick={() => void d.onConfirmDelete()}>{d.busy ? "正在删除…" : "确认删除"}</Button></DialogFooter></DialogContent></Dialog></>;
}
