import type { BrowserDirectoryHandle } from "./browser-files";
import { createId } from "./uuid";

export type BrowserDraft = { id: string; body: string; tags: string[]; baseHash: string | null; relativePath?: string; updatedAt: string; draftKey: string; vaultBinding?: string };
export type StoredSelection = { directoryId: string; vaultId: string; handle: BrowserDirectoryHandle };
export type BrowserVaultStorage = {
  loadSelection(): Promise<StoredSelection | undefined>;
  remember(handle: BrowserDirectoryHandle, vaultId: string): Promise<StoredSelection>;
  drafts(scope: string): Promise<BrowserDraft[]>;
  putDraft(scope: string, draft: BrowserDraft): Promise<void>;
  removeMatchingDraft(scope: string, draft: BrowserDraft): Promise<void>;
};

type DraftRecord = { scope: string; draft: BrowserDraft };

function sameDraft(left: BrowserDraft, right: BrowserDraft): boolean {
  return left.id === right.id && left.body === right.body && left.baseHash === right.baseHash
    && JSON.stringify(left.tags) === JSON.stringify(right.tags);
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

  async removeMatchingDraft(scope: string, draft: BrowserDraft): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("state", "readwrite");
      const store = transaction.objectStore("state");
      const key = `draft:${scope}:${draft.draftKey}`;
      const request = store.get(key);
      request.onsuccess = () => {
        const existing = request.result as DraftRecord | undefined;
        if (existing && sameDraft(existing.draft, draft)) store.delete(key);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
