import type { BridgeRequest, BridgeResponse, Coverage, Note, NotePage, VaultStatus } from "@memocard/contracts";
import { Document } from "yaml";
import { linkCandidates } from "./link-candidates";
import { createId } from "./uuid";
import { BrowserVaultError, canonicalId, encodeBrowserNote, encodeObsidianNote, parseObsidianNote, fileAt, fileError, imageType, parseBrowserNote, parseDate, readBytes, safeParts, sha256, validatedTags } from "./browser-files";
import type { BrowserDirectoryHandle, BrowserFileHandle, BrowserPicker, BrowserWritable, ParsedBrowserNote } from "./browser-files";
import { IndexedDBVaultStorage } from "./browser-storage";
import type { BrowserDraft, BrowserVaultStorage, StoredSelection } from "./browser-storage";

export { BrowserVaultError } from "./browser-files";
export type { BrowserDirectoryHandle, BrowserFileHandle, BrowserPicker } from "./browser-files";
export type { BrowserVaultStorage, BrowserDraft, StoredSelection } from "./browser-storage";

type Metadata = { formatVersion: 1 | 2; vaultId: string };
type Binding = StoredSelection & { binding: string };
type Snapshot = { folders: string[]; parsed: ParsedBrowserNote[]; duplicateIds: Set<string>; coverage: Coverage };
type ParsedCacheEntry = { hash: string; vaultId: string; identityId?: string; createdAt?: string; modified?: number; parsed: ParsedBrowserNote };
type Save = { id: string; body: string; tags: string[]; baseHash: string | null; relativePath?: string; draftKey: string };
type BrowserLock = <T>(name: string, task: () => Promise<T>) => Promise<T>;
type Options = {
  storage?: BrowserVaultStorage;
  picker?: BrowserPicker;
  lock?: BrowserLock;
  supported?: () => boolean;
  decodeImage?: (blob: Blob) => Promise<void>;
  parseLegacy?: typeof parseBrowserNote;
  parseCompatible?: typeof parseObsidianNote;
};
const operations = ["getStatus", "queryNotes", "getNote", "saveNote", "listTags", "listFolders", "resolveLink", "saveDraft", "getDrafts", "importAttachment"];
const coverageEmpty = (): Coverage => ({ complete: false, indexed: 0, pending: 0, issues: 0, indexedAt: null });
const now = () => new Date().toISOString();
const textBytes = (text: string) => new TextEncoder().encode(text);
const missing = (error: unknown) => error instanceof Error && error.name === "NotFoundError";

function browserPicker(): BrowserPicker | undefined {
  return typeof window !== "undefined" ? (window as unknown as { showDirectoryPicker?: BrowserPicker }).showDirectoryPicker?.bind(window) : undefined;
}

export function browserFileAccessSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && !!browserPicker()
    && typeof indexedDB !== "undefined" && !!globalThis.crypto?.subtle && !!navigator.locks;
}

const browserLock: BrowserLock = (name, task) => {
  if (!globalThis.navigator?.locks) return Promise.reject(new BrowserVaultError("BROWSER_UNSUPPORTED", "当前浏览器不支持安全的本地文件读写，请使用新版桌面 Chrome 或 Edge。"));
  return navigator.locks.request(name, task);
};

function checkString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new BrowserVaultError("INVALID_PARAMS", `${name} 必须是字符串。`);
  return value;
}

export class BrowserVault {
  private selection?: Binding;
  private compatible = false;
  private initialized?: Promise<void>;
  private readonly storage: BrowserVaultStorage;
  private readonly picker: () => BrowserPicker | undefined;
  private readonly lock: BrowserLock;
  private readonly supported: () => boolean;
  private readonly decodeImage: (blob: Blob) => Promise<void>;
  private readonly parseLegacy: typeof parseBrowserNote;
  private readonly parseCompatible: typeof parseObsidianNote;
  private readonly sessionId = createId();
  private readonly recoveredDrafts = new Map<string, { key: string; original?: BrowserDraft }>();
  private refreshSnapshot?: Snapshot;
  private refreshSnapshotConsumers = new Set<string>();
  private readonly parsedCache = new Map<string, ParsedCacheEntry>();

  constructor(options: Options = {}) {
    this.storage = options.storage ?? new IndexedDBVaultStorage();
    this.picker = options.picker ? () => options.picker : browserPicker;
    this.lock = options.lock ?? browserLock;
    this.supported = options.supported ?? browserFileAccessSupported;
    this.decodeImage = options.decodeImage ?? (async (blob) => {
      const image = await createImageBitmap(blob);
      const valid = image.width > 0 && image.height > 0;
      image.close();
      if (!valid) throw new Error("empty image");
    });
    this.parseLegacy = options.parseLegacy ?? parseBrowserNote;
    this.parseCompatible = options.parseCompatible ?? parseObsidianNote;
  }

  get binding(): string | null { return this.selection?.binding ?? null; }

  private invalidateSnapshot(): void {
    this.refreshSnapshot = undefined;
    this.refreshSnapshotConsumers.clear();
  }

  private seedRefreshSnapshot(snapshot: Snapshot): void {
    this.refreshSnapshot = snapshot;
    this.refreshSnapshotConsumers = new Set(["queryNotes", "listTags", "listFolders"]);
  }

  private async snapshotFor(consumer: string, selected: Binding): Promise<Snapshot> {
    const snapshot = this.refreshSnapshot;
    if (!snapshot || !this.refreshSnapshotConsumers.delete(consumer)) return this.scan(selected);
    await this.active(selected);
    if (!this.refreshSnapshotConsumers.size) this.invalidateSnapshot();
    return snapshot;
  }

  private initialize(): Promise<void> {
    this.initialized ??= (async () => {
      if (!this.supported()) return;
      const selected = await this.storage.loadSelection();
      if (selected) this.selection = { ...selected, binding: createId() };
    })();
    return this.initialized;
  }

  /** This method enters the picker before the first await, preserving the button's user activation. */
  request = (message: BridgeRequest): Promise<BridgeResponse> => {
    let work: Promise<unknown>;
    try {
      if (message.version !== 1) throw new BrowserVaultError("INVALID_PARAMS", "不支持此接口版本。");
      if (message.operation === "selectVault") {
        if (message.params.create !== undefined && typeof message.params.create !== "boolean") throw new BrowserVaultError("INVALID_PARAMS", "create 必须是布尔值。");
        const picker = this.picker();
        if (!this.supported() || !picker) throw new BrowserVaultError("BROWSER_UNSUPPORTED", "请使用新版桌面 Chrome 或 Edge，通过 HTTPS 或本机地址打开记忆卡。");
        const picked = picker({ id: "memocard-vault", mode: "readwrite" });
        work = this.select(picked, message.params.create === true);
      } else if (message.operation === "reauthorizeVault") {
        const selected = this.selection;
        if (!selected) throw new BrowserVaultError("VAULT_NOT_OPEN", "请先选择笔记库。");
        const permission = selected.handle.requestPermission({ mode: "readwrite" });
        work = permission.then(async (value) => {
          this.requireBinding(selected);
          if (value !== "granted") throw new BrowserVaultError("UNAUTHORIZED", "未获得文件夹读写权限，本机草稿仍然保留。");
          await this.active(selected);
          return { vaultId: selected.vaultId, vaultBinding: selected.binding };
        });
      } else {
        // Capture immediately when initialized: asynchronous work must never retarget a replacement vault.
        const selected = this.selection;
        work = this.initialize().then(() => this.perform(message.operation, message.params, selected ?? this.selection));
      }
    } catch (error) { work = Promise.reject(error); }
    return work.then((data) => ({ ok: true as const, data }), (error: unknown) => {
      const failure = fileError(error);
      return { ok: false as const, error: { code: failure.code, message: failure.message, retryable: failure.retryable } };
    });
  };

  private requireBinding(selected: Binding | undefined, expected?: unknown): asserts selected is Binding {
    if (!selected) throw new BrowserVaultError("VAULT_NOT_OPEN", "请先选择笔记库。");
    if (selected.binding !== this.selection?.binding || (expected !== undefined && expected !== selected.binding)) {
      throw new BrowserVaultError("UNAUTHORIZED", "笔记库已切换，请关闭旧编辑器后重新打开；原草稿仍保留在原笔记库下。");
    }
  }

  private scope(selected: Binding): string { return `${selected.directoryId}:${selected.vaultId}`; }

  private async metadata(root: BrowserDirectoryHandle): Promise<Metadata> {
    let bytes: Uint8Array;
    try {
      const directory = await root.getDirectoryHandle(".memocard");
      bytes = await readBytes(await directory.getFileHandle("vault.json"));
    } catch (error) {
      if (missing(error)) throw new BrowserVaultError("VAULT_NOT_FOUND", "所选目录没有完整的 MemoCard 笔记库，请确认文件已下载。");
      throw error;
    }
    let value: unknown;
    try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new BrowserVaultError("INVALID_VAULT", "无法解析笔记库元文件。"); }
    if (!value || typeof value !== "object" || !("formatVersion" in value) || !("vaultId" in value)) throw new BrowserVaultError("INVALID_VAULT", "笔记库元文件缺少必要字段。");
    if (value.formatVersion !== 1 && value.formatVersion !== 2) throw new BrowserVaultError("UNSUPPORTED_FORMAT", "当前应用不支持此笔记库格式。");
    return { formatVersion: value.formatVersion, vaultId: canonicalId(value.vaultId) };
  }

  private async active(selected: Binding): Promise<void> {
    this.requireBinding(selected);
    if (await selected.handle.queryPermission({ mode: "readwrite" }) !== "granted") throw new BrowserVaultError("UNAUTHORIZED", "文件夹授权已失效，请重新授权；本机草稿仍然保留。", true);
    const metadata = await this.metadata(selected.handle);
    this.compatible = metadata.formatVersion === 2;
    if (metadata.vaultId !== selected.vaultId) throw new BrowserVaultError("VAULT_CHANGED", "文件夹中的笔记库已变化，请重新选择。");
    this.requireBinding(selected);
  }

  private async select(picked: Promise<BrowserDirectoryHandle>, create: boolean): Promise<unknown> {
    let stage = "选择文件夹并授权";
    try {
      const root = await picked;
      stage = "初始化浏览器存储";
      await this.initialize();
      stage = "等待笔记库访问锁";
      return await this.lock("memocard:browser:registration", async () => {
        stage = "检查文件夹读写权限";
        if (await root.queryPermission({ mode: "readwrite" }) !== "granted") throw new BrowserVaultError("UNAUTHORIZED", "未获得所选文件夹的读写权限。");
        stage = "校验笔记库文件";
        if (create) {
          let existing: Metadata | undefined;
          try { existing = await this.metadata(root); }
          catch (error) { if (!(error instanceof BrowserVaultError) || error.code !== "VAULT_NOT_FOUND") throw error; }
          if (!existing) {
            for await (const [name] of root.entries()) {
              if (name !== ".DS_Store") throw new BrowserVaultError("VAULT_NOT_EMPTY", "请在空目录中创建笔记库。");
            }
            const metadata = await root.getDirectoryHandle(".memocard", { create: true });
            const file = await metadata.getFileHandle("vault.json", { create: true });
            const stream = await file.createWritable({ mode: "exclusive" });
            try { await stream.write(JSON.stringify({ formatVersion: 2, vaultId: createId() }, null, 2) + "\n"); await stream.close(); }
            catch (error) { await stream.abort().catch(() => undefined); throw error; }
          }
        }
        let metadata: Metadata;
        try { metadata = await this.metadata(root); }
        catch (error) {
          if (!(error instanceof BrowserVaultError) || error.code !== "VAULT_NOT_FOUND") throw error;
          metadata = { formatVersion: 2, vaultId: createId() };
          const directory = await root.getDirectoryHandle(".memocard", { create: true });
          const file = await directory.getFileHandle("vault.json", { create: true });
          const stream = await file.createWritable({ mode: "exclusive" });
          try { await stream.write(JSON.stringify(metadata) + "\n"); await stream.close(); }
          catch (error) { await stream.abort().catch(() => undefined); throw error; }
        }
        this.compatible = metadata.formatVersion === 2;
        if (!this.compatible) try { await root.getDirectoryHandle("notes"); await root.getDirectoryHandle("assets"); }
        catch (error) { if (missing(error)) throw new BrowserVaultError("INVALID_VAULT", "笔记库缺少 notes 或 assets 目录。"); throw error; }
        stage = "保存文件夹授权到浏览器";
        const remembered = await this.storage.remember(root, metadata.vaultId);
        this.invalidateSnapshot();
        this.parsedCache.clear();
        this.selection = { ...remembered, binding: createId() };
        return { vaultId: metadata.vaultId, vaultBinding: this.selection.binding };
      });
    } catch (error) {
      // Keep the stage and exception type, never file paths or note content.
      const name = error instanceof Error ? error.name : "UnknownError";
      const diagnostic = `${stage} / ${name}`;
      if (stage === "选择文件夹并授权" && name === "AbortError") return { cancelled: true, diagnostic };
      const failure = fileError(error);
      throw new BrowserVaultError(failure.code, `${failure.message}（${diagnostic}）`, failure.retryable);
    }
  }

  private scan(selected: Binding): Promise<Snapshot> {
    return this.lock(`memocard:browser:index:${this.scope(selected)}`, () => this.scanFiles(selected));
  }

  private async scanFiles(selected: Binding): Promise<Snapshot> {
    await this.active(selected);
    const snapshot: Snapshot = { folders: [this.compatible ? "" : "notes"], parsed: [], duplicateIds: new Set(), coverage: { ...coverageEmpty(), complete: true } };
    const old = this.compatible ? await this.storage.identities(this.scope(selected)) : [];
    const files: { path: string; bytes: Uint8Array; modified: number; hash: string }[] = [];
    const scannedPaths = new Set<string>();
    const walk = async (directory: BrowserDirectoryHandle, path: string): Promise<void> => {
      try {
        for await (const [name, child] of directory.entries()) {
          if (name.startsWith(".")) continue;
          const relativePath = path ? `${path}/${name}` : name;
          safeParts(relativePath, this.compatible ? "vault" : "notes");
          if (child.kind === "directory") { snapshot.folders.push(relativePath); await walk(child, relativePath); continue; }
          if (!/\.md$/i.test(name)) continue;
          try {
            const bytes = await readBytes(child);
            const hash = await sha256(bytes);
            scannedPaths.add(relativePath);
            if (this.compatible) files.push({ path: relativePath, bytes, modified: (await child.getFile()).lastModified, hash });
            else {
              const cached = this.parsedCache.get(relativePath);
              if (cached?.hash === hash && cached.vaultId === selected.vaultId && cached.identityId === undefined && cached.modified === undefined) {
                snapshot.parsed.push(cached.parsed);
              } else {
                const parsed = await this.parseLegacy(bytes, relativePath, selected.vaultId);
                this.parsedCache.set(relativePath, { hash, vaultId: selected.vaultId, parsed });
                snapshot.parsed.push(parsed);
              }
            }
          }
          catch (error) {
            const failure = fileError(error);
            if (failure.code === "UNAUTHORIZED") throw failure;
            if (failure.code === "FILE_PENDING" || failure.code === "FILE_NOT_FOUND") snapshot.coverage.pending++;
            else snapshot.coverage.issues++;
          }
        }
      } catch (error) {
        const failure = fileError(error);
        if (failure.code === "UNAUTHORIZED") throw failure;
        snapshot.coverage.issues++;
      }
    };
    await walk(this.compatible ? selected.handle : await selected.handle.getDirectoryHandle("notes"), this.compatible ? "" : "notes");
    if (this.compatible) {
      const identities = [];
      const paths = new Set(files.map(file => file.path));
      const existingByPath = new Map(old.map(item => [item.path, item]));
      const missingByHash = new Map<string, typeof old>();
      for (const item of old) if (!paths.has(item.path)) {
        const values = missingByHash.get(item.hash) ?? [];
        values.push(item); missingByHash.set(item.hash, values);
      }
      const newByHash = new Map<string, typeof files>();
      for (const item of files) if (!existingByPath.has(item.path)) {
        const values = newByHash.get(item.hash) ?? [];
        values.push(item); newByHash.set(item.hash, values);
      }
      for (const file of files) {
        const moved = missingByHash.get(file.hash) ?? [];
        const candidates = newByHash.get(file.hash) ?? [];
        const identity = existingByPath.get(file.path)
          ?? (moved.length === 1 && candidates.length === 1 ? moved[0] : undefined);
        const entry = { id: identity?.id ?? createId(), path: file.path, hash: file.hash, createdAt: identity?.createdAt ?? new Date(file.modified || 0).toISOString() };
        identities.push(entry);
        try {
          const cached = this.parsedCache.get(file.path);
          if (cached?.hash === file.hash && cached.vaultId === selected.vaultId && cached.identityId === entry.id
            && cached.createdAt === entry.createdAt && cached.modified === file.modified) {
            snapshot.parsed.push(cached.parsed);
          } else {
            const parsed = await this.parseCompatible(file.bytes, file.path, selected.vaultId, entry, file.modified);
            this.parsedCache.set(file.path, { hash: file.hash, vaultId: selected.vaultId, identityId: entry.id, createdAt: entry.createdAt, modified: file.modified, parsed });
            snapshot.parsed.push(parsed);
          }
        }
        catch { snapshot.coverage.issues++; }
      }
      if (!snapshot.coverage.issues && !snapshot.coverage.pending) await this.storage.saveIdentities(this.scope(selected), identities);
    }
    for (const path of this.parsedCache.keys()) if (!scannedPaths.has(path)) this.parsedCache.delete(path);
    const counts = new Map<string, number>();
    for (const { note } of snapshot.parsed) counts.set(note.id, (counts.get(note.id) ?? 0) + 1);
    for (const [id, count] of counts) if (count > 1) { snapshot.duplicateIds.add(id); snapshot.coverage.issues += count; }
    snapshot.parsed = snapshot.parsed.filter(({ note }) => !snapshot.duplicateIds.has(note.id));
    snapshot.parsed.sort((a, b) => parseDate(b.note.createdAt) - parseDate(a.note.createdAt) || (a.note.id < b.note.id ? -1 : a.note.id > b.note.id ? 1 : 0));
    snapshot.coverage.indexed = snapshot.parsed.length;
    snapshot.coverage.complete = !snapshot.coverage.pending && !snapshot.coverage.issues;
    snapshot.coverage.indexedAt = now();
    this.requireBinding(selected);
    return snapshot;
  }

  private async environment() {
    const supported = this.supported();
    const selected = this.selection;
    const granted = selected ? await selected.handle.queryPermission({ mode: "readwrite" }).catch(() => "denied") === "granted" : false;
    return { platform: "web", phase: "M1", storage: "browser", mcpEnabled: false, supported, vaultBinding: selected?.binding ?? null,
      capabilities: supported ? ["selectVault", "createVault", "openExternal", ...(selected && !granted ? ["reauthorizeVault"] : []), ...(granted ? ["pickImage"] : [])] : ["openExternal"] };
  }

  private async status(selected: Binding | undefined): Promise<VaultStatus & { vaultBinding: string | null }> {
    this.invalidateSnapshot();
    const base = { connected: false, vaultId: selected?.vaultId ?? null, vaultName: selected?.handle.name ?? null, vaultBinding: selected?.binding ?? null,
      phase: "M1", syncState: "notConnected", capabilities: [] as string[], coverage: coverageEmpty() };
    if (!selected) return base;
    this.requireBinding(selected);
    if (await selected.handle.queryPermission({ mode: "readwrite" }).catch(() => "denied") !== "granted") {
      return { ...base, syncState: "unauthorized", capabilities: ["saveDraft", "getDrafts", "reauthorizeVault"] };
    }
    const snapshot = await this.scan(selected);
    this.seedRefreshSnapshot(snapshot);
    return { ...base, connected: true, syncState: snapshot.coverage.complete ? "localReadComplete" : "incomplete", capabilities: operations, coverage: snapshot.coverage };
  }

  private saveParams(params: Record<string, unknown>): Save {
    const id = canonicalId(params.id);
    if (params.baseHash !== null && params.baseHash !== undefined && (typeof params.baseHash !== "string" || !/^[a-f0-9]{64}$/.test(params.baseHash))) throw new BrowserVaultError("INVALID_PARAMS", "baseHash 必须是有效的内容指纹。");
    const relativePath = params.relativePath === undefined ? undefined : checkString(params.relativePath, "relativePath");
    if (relativePath) safeParts(relativePath, this.compatible ? "vault" : "notes");
    const draftKey = params.draftKey === undefined ? `${this.sessionId}:${id}` : checkString(params.draftKey, "draftKey");
    if (!/^[a-f\d-]{36}:[a-f\d-]{36}$/.test(draftKey) || draftKey.split(":")[1] !== id) throw new BrowserVaultError("INVALID_PARAMS", "草稿标识无效。");
    return { id, body: checkString(params.body, "body"), tags: validatedTags(params.tags), baseHash: params.baseHash as string | null ?? null, relativePath, draftKey };
  }

  private async storeDraft(selected: Binding, save: Save): Promise<BrowserDraft> {
    this.requireBinding(selected);
    const scope = this.scope(selected);
    let draftKey = save.draftKey;
    const ownRecovered = [...this.recoveredDrafts.values()].some((value) => value.key === draftKey);
    if (!draftKey.startsWith(`${this.sessionId}:`) && !ownRecovered) {
      const sourceKey = `${scope}:${draftKey}`;
      let recovered = this.recoveredDrafts.get(sourceKey);
      if (!recovered) {
        const original = (await this.storage.drafts(scope)).find((draft) => draft.draftKey === draftKey);
        recovered = { key: `${createId()}:${save.id}`, original };
        this.recoveredDrafts.set(sourceKey, recovered);
      }
      draftKey = recovered.key;
    }
    const draft = { ...save, draftKey, updatedAt: now(), vaultBinding: selected.binding };
    await this.storage.putDraft(scope, draft);
    this.requireBinding(selected);
    return draft;
  }

  private newNotePath(value: unknown, id: string, snapshot: Snapshot): string {
    const path = value === undefined ? `${this.compatible ? "" : "notes/"}${id}.md` : value;
    if (typeof path !== "string" || !path.endsWith(".md")) throw new BrowserVaultError("PATH_NOT_ALLOWED", "请选择笔记目录中的 Markdown 文件。");
    const parts = safeParts(path, this.compatible ? "vault" : "notes");
    if (!snapshot.folders.includes(parts.slice(0, -1).join("/"))) throw new BrowserVaultError("FOLDER_NOT_FOUND", "保存目录已移除，请保留草稿并重新选择目录。");
    return path;
  }

  private async save(selected: Binding, save: Save): Promise<Note & { vaultBinding: string }> {
    this.invalidateSnapshot();
    // File writes only start after a durable local draft has succeeded.
    const draft = await this.storeDraft(selected, save);
    return this.lock(`memocard:browser:vault:${selected.vaultId}`, async () => {
      this.requireBinding(selected);
      const snapshot = await this.scan(selected);
      if (snapshot.duplicateIds.has(save.id)) throw new BrowserVaultError("DUPLICATE_ID", "多份文件使用同一个 ID，无法覆盖保存。");
      if (!snapshot.coverage.complete) throw new BrowserVaultError("SCAN_INCOMPLETE", "笔记库包含不可读或格式异常文件；草稿已保留，处理后再提交。", true);
      const existing = snapshot.parsed.find(({ note }) => note.id === save.id);
      if (!existing && save.baseHash) throw new BrowserVaultError("NOTE_NOT_FOUND", "原文件已移除，不能从旧草稿自动恢复。");
      if (existing?.note.deletedAt) throw new BrowserVaultError("NOTE_DELETED", "此笔记已删除，暂时无法编辑。");
      let requestedPath = save.relativePath;
      if (this.compatible && !existing && !save.baseHash && (!requestedPath || requestedPath.endsWith(`${save.id}.md`))) {
        const title = (save.body.split(/\r?\n/).find(line => line.trim()) ?? "未命名").replace(/^[#\s]+/, "").replace(/[\\/:*?"<>|#^]/g, " ").trim().replace(/^\.+/, "").slice(0, 60) || "未命名";
        requestedPath = (requestedPath?.includes("/") ? requestedPath.slice(0, requestedPath.lastIndexOf("/") + 1) : "") + `${title}-${save.id.slice(0, 8)}.md`;
      }
      const path = existing?.note.relativePath ?? this.newNotePath(requestedPath, save.id, snapshot);
      let file: BrowserFileHandle | undefined;
      try { file = await fileAt(selected.handle, path, this.compatible ? "vault" : "notes"); } catch (error) { if (!missing(error)) throw error; }
      if (file && !existing) throw new BrowserVaultError("HASH_CONFLICT", "目标文件已存在，原文未被覆盖。");
      if (!file && existing) throw new BrowserVaultError("NOTE_NOT_FOUND", "原文件已移除，不能从旧草稿自动恢复。");
      let frontmatter: Document;
      let original: ParsedBrowserNote | undefined;
      if (file) {
        const bytes = await readBytes(file);
        if (await sha256(bytes) !== save.baseHash) throw new BrowserVaultError("HASH_CONFLICT", "文件已在其他位置修改，原文未被覆盖；草稿仍然保留。");
        const parsed = this.compatible ? await parseObsidianNote(bytes, path, selected.vaultId, { id: save.id, path, hash: save.baseHash!, createdAt: existing!.note.createdAt }, (await file.getFile()).lastModified) : await parseBrowserNote(bytes, path, selected.vaultId);
        original = parsed;
        if (parsed.note.id !== save.id || parsed.note.deletedAt) throw new BrowserVaultError("HASH_CONFLICT", "目标文件的身份或删除状态已改变。");
        frontmatter = parsed.frontmatter;
      } else {
        frontmatter = new Document({ id: save.id, createdAt: now() }, { schema: "yaml-1.1" });
      }
      if (!this.compatible) { frontmatter.set("updatedAt", now()); frontmatter.set("tags", save.tags); }
      const bytes = this.compatible ? encodeObsidianNote(original, save.body, save.tags) : encodeBrowserNote(frontmatter, save.body);
      const newlyCreated = !file;
      await this.active(selected);
      file ??= await fileAt(selected.handle, path, this.compatible ? "vault" : "notes", true);
      let stream: BrowserWritable | undefined;
      try {
        stream = await file.createWritable({ mode: "exclusive" });
        const verify = async () => {
          await this.active(selected);
          const current = await fileAt(selected.handle, path, this.compatible ? "vault" : "notes");
          if (!await current.isSameEntry(file!)) throw new BrowserVaultError("HASH_CONFLICT", "文件路径已被外部修改，草稿仍然保留。");
          const source = await readBytes(current);
          if (newlyCreated ? source.byteLength !== 0 : await sha256(source) !== save.baseHash) {
            throw new BrowserVaultError("HASH_CONFLICT", "文件已在其他位置修改，原文未被覆盖；草稿仍然保留。");
          }
          this.requireBinding(selected);
        };
        await verify();
        await stream.write(bytes);
        // The browser stages writes until close. It offers no OS-wide compare-and-swap;
        // external editors can still change the file in the final check/close interval.
        await verify();
        await stream.close();
        stream = undefined;
      } catch (error) {
        await stream?.abort().catch(() => undefined);
        if (newlyCreated) {
          // Remove only our still-empty placeholder, never a file another editor filled.
          try {
            const current = await fileAt(selected.handle, path, this.compatible ? "vault" : "notes");
            if (await current.isSameEntry(file) && (await current.getFile()).size === 0) {
              let directory = selected.handle;
              const parts = path.split("/");
              for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
              await directory.removeEntry(parts.at(-1)!);
            }
          } catch { /* Preserve recovery evidence when cleanup is uncertain. */ }
        }
        throw error;
      }
      const saved = this.compatible ? await parseObsidianNote(bytes, path, selected.vaultId, { id: save.id, path, hash: await sha256(bytes), createdAt: existing?.note.createdAt ?? now() }, Date.now()) : await parseBrowserNote(bytes, path, selected.vaultId);
      if (this.compatible) {
        const identities = await this.storage.identities(this.scope(selected));
        await this.storage.saveIdentities(this.scope(selected), [...identities.filter(item => item.id !== save.id), { id: save.id, path, hash: saved.note.contentHash, createdAt: saved.note.createdAt }]);
      }
      try {
        await this.storage.removeMatchingDraft(this.scope(selected), draft);
        const recovered = [...this.recoveredDrafts.values()].find((value) => value.key === draft.draftKey);
        if (recovered?.original) await this.storage.removeMatchingDraft(this.scope(selected), recovered.original);
      } catch { /* The source commit has succeeded; leave the draft for recovery. */ }
      return { ...saved.note, vaultBinding: selected.binding };
    });
  }

  private async query(selected: Binding, params: Record<string, unknown>): Promise<NotePage> {
    const query = params.query === undefined ? "" : checkString(params.query, "query");
    const tags = params.tags === undefined ? [] : validatedTags(params.tags);
    const from = params.from === undefined ? undefined : parseDate(params.from);
    const to = params.to === undefined ? undefined : parseDate(params.to);
    if (from !== undefined && to !== undefined && from > to) throw new BrowserVaultError("INVALID_PARAMS", "开始时间不能晚于结束时间。");
    const limit = params.limit ?? 50;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100 || (params.deleted !== undefined && typeof params.deleted !== "boolean")) throw new BrowserVaultError("INVALID_PARAMS", "分页大小必须为 1 至 100，deleted 必须为布尔值。");
    const snapshot = await this.snapshotFor("queryNotes", selected);
    const queryHash = await sha256(textBytes(JSON.stringify({ query, tags, from, to, limit, folder: params.folder, deleted: params.deleted ?? false })));
    const snapshotHash = await sha256(textBytes(JSON.stringify({ binding: selected.binding, notes: snapshot.parsed.map(({ note }) => [note.id, note.contentHash, note.relativePath]), pending: snapshot.coverage.pending, issues: snapshot.coverage.issues })));
    let after: { id: string; createdAt: string } | undefined;
    if (params.cursor !== undefined) {
      let cursor: unknown;
      try { cursor = JSON.parse(atob(checkString(params.cursor, "cursor"))); } catch { throw new BrowserVaultError("INVALID_CURSOR", "分页游标无效。"); }
      if (!cursor || typeof cursor !== "object" || !("queryHash" in cursor) || !("snapshotHash" in cursor) || !("id" in cursor) || !("createdAt" in cursor)) throw new BrowserVaultError("INVALID_CURSOR", "分页游标无效。");
      if (cursor.queryHash !== queryHash) throw new BrowserVaultError("CURSOR_QUERY_MISMATCH", "筛选条件已变化，请从第一页重新读取。");
      if (cursor.snapshotHash !== snapshotHash) throw new BrowserVaultError("STALE_CURSOR", "笔记库已变化，请从第一页重新读取。", true);
      const id = canonicalId(cursor.id), createdAt = checkString(cursor.createdAt, "createdAt"); parseDate(createdAt);
      after = { id, createdAt };
    }
    const folder = params.folder === undefined ? undefined : checkString(params.folder, "folder");
    if (folder) safeParts(folder, this.compatible ? "vault" : "notes");
    const normalized = query.normalize("NFC").toLowerCase();
    const matching = snapshot.parsed.map(({ note }) => note).filter((note) => {
      const date = parseDate(note.createdAt);
      return (!folder || note.relativePath.startsWith(`${folder}/`)) && !!note.deletedAt === (params.deleted ?? false)
        && note.body.normalize("NFC").toLowerCase().includes(normalized) && tags.every((tag) => note.tags.some(value => value === tag || value.startsWith(tag + "/")))
        && (from === undefined || date >= from) && (to === undefined || date < to)
        && (!after || date < parseDate(after.createdAt) || (date === parseDate(after.createdAt) && note.id > after.id));
    });
    const notes: Note[] = [];
    let byteCount = 0;
    for (const note of matching.slice(0, limit)) {
      const size = textBytes(JSON.stringify(note)).byteLength;
      if (notes.length && byteCount + size > 2 * 1024 * 1024) break;
      notes.push({ ...note, vaultBinding: selected.binding } as Note); byteCount += size;
    }
    const last = notes.at(-1);
    const nextCursor = matching.length > notes.length && last ? btoa(JSON.stringify({ id: last.id, createdAt: last.createdAt, queryHash, snapshotHash })) : null;
    return { notes, nextCursor, coverage: snapshot.coverage };
  }

  private async attachment(selected: Binding, params: Record<string, unknown>): Promise<unknown> {
    this.invalidateSnapshot();
    const name = checkString(params.name, "name");
    if (!name || /[/\\]/.test(name) || name.includes("\0")) throw new BrowserVaultError("INVALID_ATTACHMENT", "图片名称不能包含目录。");
    let bytes: Uint8Array;
    try {
      const base64 = checkString(params.base64, "base64");
      if (base64.length > 28 * 1024 * 1024) throw new Error("too large");
      bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    } catch { throw new BrowserVaultError("INVALID_ATTACHMENT", "图片内容无效或超过 20 MB。"); }
    if (!bytes.length || bytes.byteLength > 20 * 1024 * 1024) throw new BrowserVaultError("INVALID_ATTACHMENT", "图片不能为空或超过 20 MB。");
    const type = imageType(bytes);
    if (!type) throw new BrowserVaultError("INVALID_ATTACHMENT", "请选择有效的 PNG、JPEG、GIF、WebP、HEIC 或 HEIF 图片。");
    if (type.extension === "heic") throw new BrowserVaultError("UNSUPPORTED_ATTACHMENT", "此浏览器无法可靠读取 HEIC 或 HEIF 图片，请先转换为 PNG 或 JPEG。");
    try { await this.decodeImage(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: type.mime })); }
    catch { throw new BrowserVaultError("INVALID_ATTACHMENT", "无法解码这张图片，请重新选择有效的 PNG、JPEG、GIF 或 WebP 图片。"); }
    return this.lock(`memocard:browser:vault:${selected.vaultId}`, async () => {
      const snapshot = await this.scan(selected);
      const id = params.noteId === undefined ? undefined : canonicalId(params.noteId);
      if (id && snapshot.duplicateIds.has(id)) throw new BrowserVaultError("DUPLICATE_ID", "笔记 ID 重复，无法确定图片引用位置。");
      if (!snapshot.coverage.complete) throw new BrowserVaultError("SCAN_INCOMPLETE", "笔记库包含不可读或格式异常文件，暂时无法确定图片引用位置。", true);
      const note = snapshot.parsed.find(({ note }) => note.id === id)?.note;
      if (note?.deletedAt) throw new BrowserVaultError("NOTE_DELETED", "此笔记已删除，无法导入图片。");
      const notePath = note?.relativePath ?? this.newNotePath(params.notePath, id ?? "new", snapshot);
      const relativePath = `assets/${createId()}.${type.extension}`;
      await this.active(selected);
      await selected.handle.getDirectoryHandle("assets", { create: true });
      const file = await fileAt(selected.handle, relativePath, "assets", true);
      const stream = await file.createWritable({ mode: "exclusive" });
      try { await stream.write(bytes); await this.active(selected); await stream.close(); }
      catch (error) { await stream.abort().catch(() => undefined); throw error; }
      return { relativePath, markdownPath: "../".repeat(notePath.split("/").length - 1) + relativePath, notePath };
    });
  }

  async asset(path: string, expectedBinding?: string): Promise<Blob> {
    const selected = this.selection;
    await this.initialize();
    const context = selected ?? this.selection;
    this.requireBinding(context, expectedBinding);
    await this.active(context);
    safeParts(path, this.compatible ? "vault" : "assets");
    if (!/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(path)) throw new BrowserVaultError("PATH_NOT_ALLOWED", "只允许读取笔记库中的图片附件。");
    const file = await (await fileAt(context.handle, path, this.compatible ? "vault" : "assets")).getFile();
    if (file.size > 20 * 1024 * 1024) throw new BrowserVaultError("INVALID_ATTACHMENT", "图片超过 20 MB。");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type) throw new BrowserVaultError("INVALID_ATTACHMENT", "附件不是支持的图片。");
    this.requireBinding(context, expectedBinding);
    return new Blob([bytes], { type: type.mime });
  }

  private async perform(operation: string, params: Record<string, unknown>, selected: Binding | undefined): Promise<unknown> {
    if (operation === "getEnvironment") return this.environment();
    if (operation === "getStatus") return this.status(selected);
    this.requireBinding(selected, params.vaultBinding);
    if (operation === "saveDraft") return this.storeDraft(selected, this.saveParams(params));
    if (operation === "getDrafts") {
      const drafts = await this.storage.drafts(this.scope(selected));
      this.requireBinding(selected);
      return { drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((draft) => ({ ...draft, vaultBinding: selected.binding })) };
    }
    if (operation === "saveNote") return this.save(selected, this.saveParams(params));
    if (operation === "queryNotes") return this.query(selected, params);
    if (operation === "importAttachment") return this.attachment(selected, params);
    if (operation === "getNote") {
      const id = canonicalId(params.id), snapshot = await this.scan(selected);
      if (snapshot.duplicateIds.has(id)) throw new BrowserVaultError("DUPLICATE_ID", "多份文件使用同一个 ID，请先处理重复文件。");
      const note = snapshot.parsed.find(({ note }) => note.id === id)?.note;
      if (!note) throw new BrowserVaultError(snapshot.coverage.complete ? "NOTE_NOT_FOUND" : "NOTE_UNAVAILABLE", snapshot.coverage.complete ? "找不到此笔记。" : "部分文件尚不可读取，暂时无法确认此笔记。", !snapshot.coverage.complete);
      return { ...note, vaultBinding: selected.binding };
    }
    if (operation === "resolveLink") {
      const target = checkString(params.target, "target"), sourcePath = checkString(params.sourcePath, "sourcePath");
      const snapshot = await this.scan(selected);
      if (!snapshot.coverage.complete) throw new BrowserVaultError("SCAN_INCOMPLETE", "笔记库尚未完整读取，无法安全解析链接。");
      const paths = snapshot.parsed.map(item => item.note.relativePath);
      const walk = async (directory: BrowserDirectoryHandle, parent = ""): Promise<void> => {
        for await (const [name, child] of directory.entries()) {
          if (name.startsWith(".")) continue;
          const path = parent + name;
          if (child.kind === "directory") await walk(child, path + "/");
          else if (/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(path)) paths.push(path);
        }
      };
      await walk(selected.handle);
      this.requireBinding(selected);
      const matches = linkCandidates(target, sourcePath, paths, params.wiki === true);
      if (matches.length !== 1) throw new BrowserVaultError(matches.length ? "AMBIGUOUS_LINK" : "LINK_NOT_FOUND", matches.length ? "链接匹配多份文件，请使用完整路径。" : "找不到链接目标。");
      const note = snapshot.parsed.find(item => item.note.relativePath === matches[0])?.note;
      return note ? { kind: "note", id: note.id, path: matches[0] } : { kind: "image", path: matches[0] };
    }
    if (operation === "listFolders") {
      const snapshot = await this.snapshotFor("listFolders", selected);
      return { folders: snapshot.folders.sort(), coverage: snapshot.coverage };
    }
    if (operation === "listTags") {
      const snapshot = await this.snapshotFor("listTags", selected), counts = new Map<string, number>();
      for (const { note } of snapshot.parsed) if (!note.deletedAt) {
        const names = new Set(note.tags.flatMap(tag => tag.split("/").map((_, index, parts) => parts.slice(0, index + 1).join("/"))));
        for (const tag of names) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      return { tags: [...counts].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, count]) => ({ name, count })), coverage: snapshot.coverage };
    }
    throw new BrowserVaultError("UNSUPPORTED_OPERATION", "浏览器笔记库暂不支持此操作。");
  }
}

// Construction is lazy: no IndexedDB, permission prompt, or directory access occurs at import time.
export const browserVault = new BrowserVault();
export function createBrowserTransport(options: Options = {}) { return new BrowserVault(options).request; }
export const browserTransport = browserVault.request;
export const getBrowserVaultBinding = () => browserVault.binding;
export const readBrowserAsset = (path: string, expectedBinding?: string) => browserVault.asset(path, expectedBinding);
