import type { BrowserDirectoryHandle, FileIdentity } from "./browser-files";
import { createId } from "./uuid";
import type { Draft } from "./bridge";

export type BrowserDraft = Draft & { updatedAt: string; draftKey: string };
export type StoredSelection = { directoryId: string; vaultId: string; handle: BrowserDirectoryHandle };
export type RenameJournal = { changes: { path: string; before: string | null; after: string | null }[]; identities: FileIdentity[] };
export type BrowserVaultStorage = {
  renameJournal(scope: string): Promise<RenameJournal | undefined>;
  saveRenameJournal(scope: string, journal: RenameJournal | undefined, retainBackup?: boolean): Promise<void>;
  identities(scope: string): Promise<FileIdentity[]>;
  saveIdentities(scope: string, identities: FileIdentity[]): Promise<void>;
  loadSelection(): Promise<StoredSelection | undefined>;
  remember(handle: BrowserDirectoryHandle, vaultId: string): Promise<StoredSelection>;
  drafts(scope: string): Promise<BrowserDraft[]>;
  putDraft(scope: string, draft: BrowserDraft): Promise<void>;
  removeMatchingDraft(scope: string, draft: BrowserDraft): Promise<boolean>;
};

type DraftRecord = { scope: string; draft: BrowserDraft };

function sameDraft(left: BrowserDraft, right: BrowserDraft): boolean {
  return left.title === right.title && left.id === right.id && left.body === right.body && left.baseHash === right.baseHash
    && JSON.stringify(left.tags) === JSON.stringify(right.tags) && JSON.stringify(left.inheritedTags ?? []) === JSON.stringify(right.inheritedTags ?? [])
    && JSON.stringify(left.pendingProperties ?? []) === JSON.stringify(right.pendingProperties ?? []);
}

/** Handles and uncommitted drafts stay in this origin's IndexedDB, never in the vault. */
export class IndexedDBVaultStorage implements BrowserVaultStorage {
  private database?: Promise<IDBDatabase>;

  private db(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("memocard-browser-vault", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("浏览器存储被其他页面占用，请关闭旧页面后重试。"));
      request.onsuccess = () => resolve(request.result);
    });
    return this.database;
  }

  private async read<T>(key: string): Promise<T | undefined> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction("state").objectStore("state").get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  private async write(entries: [string, unknown][]): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("state", "readwrite");
      for (const [key, value] of entries) transaction.objectStore("state").put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("本机草稿写入已取消。"));
    });
  }

  renameJournal(scope: string): Promise<RenameJournal | undefined> { return this.read(`rename:${scope}`); }
  saveRenameJournal(scope: string, journal: RenameJournal | undefined, retainBackup = true): Promise<void> {
    return this.write([...(journal && retainBackup ? [[`rename-backup:${scope}:${createId()}`, journal] as [string, unknown]] : []), [`rename:${scope}`, journal]]);
  }

  async identities(scope: string): Promise<FileIdentity[]> { return await this.read(`identities:${scope}`) ?? []; }
  saveIdentities(scope: string, identities: FileIdentity[]): Promise<void> { return this.write([[`identities:${scope}`, identities]]); }

  loadSelection(): Promise<StoredSelection | undefined> { return this.read("selection"); }

  // Callers hold the origin-wide registration lock while resolving directory identity.
  async remember(handle: BrowserDirectoryHandle, vaultId: string): Promise<StoredSelection> {
    const registry = await this.read<StoredSelection[]>("registry") ?? [];
    let existing: StoredSelection | undefined;
    for (const item of registry) {
      try { if (await item.handle.isSameEntry(handle)) { existing = item; break; } } catch { /* An old permission or deleted folder must not prevent a new selection. */ }
    }
    const selection = { directoryId: existing?.directoryId ?? createId(), vaultId, handle };
    const next = [...registry.filter((item) => item.directoryId !== selection.directoryId), selection];
    await this.write([["registry", next], ["selection", selection]]);
    return selection;
  }

  async drafts(scope: string): Promise<BrowserDraft[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction("state").objectStore("state").getAll();
      request.onsuccess = () => resolve((request.result as unknown[]).filter((value): value is DraftRecord => !!value && typeof value === "object" && "scope" in value && value.scope === scope && "draft" in value).map((value) => value.draft));
      request.onerror = () => reject(request.error);
    });
  }

  putDraft(scope: string, draft: BrowserDraft): Promise<void> {
    const stored = { ...draft };
    delete stored.vaultBinding;
    return this.write([[`draft:${scope}:${draft.draftKey}`, { scope, draft: stored }]]);
  }

  async removeMatchingDraft(scope: string, draft: BrowserDraft): Promise<boolean> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("state", "readwrite");
      let removed = false;
      const store = transaction.objectStore("state");
      const key = `draft:${scope}:${draft.draftKey}`;
      const request = store.get(key);
      request.onsuccess = () => {
        const existing = request.result as DraftRecord | undefined;
        if (existing && sameDraft(existing.draft, draft) && existing.draft.revision === draft.revision && existing.draft.updatedAt === draft.updatedAt) { store.delete(key); removed = true; }
      };
      transaction.oncomplete = () => resolve(removed);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
