import type { Note } from "@memocard/contracts";
import type { Draft } from "../src/bridge";

export const editorVaultBinding = "storybook-editor-binding";
export const editorNote: Note = {
  id: "storybook-editor-note", title: "编辑示例", body: "把想法记下来。", tags: [],
  relativePath: "fixtures/editor.md", contentHash: "storybook-editor-0", sourceUrl: "",
  createdAt: "2026-10-19T08:00:00Z", updatedAt: "2026-10-19T08:00:00Z",
};

export function createEditorFixture(mode: "ready" | "retry" | "pending" = "ready") {
  const calls: { operation: string; params: Record<string, unknown> }[] = [];
  let stored = structuredClone(editorNote);
  let recovery: Record<string, unknown> | null = null;
  let failNextSave = mode === "retry";
  let revision = 0;
  let completeSave: (() => void) | undefined;
  let cancelSave: (() => void) | undefined;
  return {
    calls,
    readSaved: () => structuredClone(stored),
    readRecovery: () => structuredClone(recovery),
    completeSave: () => completeSave?.(),
    dispose: () => { cancelSave?.(); completeSave = undefined; cancelSave = undefined; },
    request(operation: string, params: Record<string, unknown>): unknown {
      if (params.id !== editorNote.id || params.vaultBinding !== editorVaultBinding) {
        throw new Error("Storybook editor fixture cannot access another note or notebook.");
      }
      calls.push({ operation, params: structuredClone(params) });
      switch (operation) {
        case "getNote": return structuredClone(stored);
        case "saveDraft":
          recovery = !params.title && !params.body && params.baseHash === null ? null : structuredClone(params);
          return { ...params, revision: "storybook-recovery", updatedAt: "2026-10-19T08:00:00Z" };
        case "saveNote": {
          if (params.relativePath !== editorNote.relativePath || params.baseHash !== stored.contentHash) {
            throw new Error("Storybook editor fixture requires the current note path and revision.");
          }
          if (failNextSave) { failNextSave = false; throw new Error("磁盘只读（内存示例）"); }
          const commit = () => {
            stored = { ...stored, title: String(params.title ?? ""), body: String(params.body), tags: [...params.tags as string[]], contentHash: `storybook-editor-${++revision}`, updatedAt: "2026-10-19T08:01:00Z" };
            recovery = null;
            return structuredClone(stored);
          };
          if (mode === "pending") return new Promise<Note>((resolve, reject) => {
            completeSave = () => { completeSave = undefined; cancelSave = undefined; resolve(commit()); };
            cancelSave = () => reject(new Error("Storybook editor fixture was closed."));
          });
          return commit();
        }
        default: throw new Error(`Storybook editor fixture has no operation: ${operation}`);
      }
    },
  };
}

export type EditorFixture = ReturnType<typeof createEditorFixture>;
export const editorDraft = (note: Note): Draft => ({
  id: note.id, title: note.title, body: note.body, tags: [...note.tags], baseHash: note.contentHash,
  relativePath: note.relativePath, vaultBinding: editorVaultBinding,
});
