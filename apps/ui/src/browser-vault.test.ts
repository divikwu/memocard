// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { BridgeRequest, Note, NotePage, VaultStatus } from "@memocard/contracts";
import { BrowserVault } from "./browser-vault";
import { parseBrowserNote } from "./browser-files";
import type { BrowserDirectoryHandle, BrowserFileHandle, BrowserWritable } from "./browser-files";
import type { BrowserDraft, BrowserVaultStorage, StoredSelection } from "./browser-storage";
import { createId } from "./uuid";

const vaultId = "22222222-2222-4222-8222-222222222222";
const noteId = "11111111-1111-4111-8111-111111111111";
const secondId = "11111111-1111-4111-8111-111111111112";
const source = (id = noteId, body = "中文 test\n", extra = "") => `---\nid: "${id}"\ncreatedAt: "2026-09-28T04:00:00Z"\nupdatedAt: "2026-09-28T04:00:00Z"\ntags: ["日常", "machine learning", "C#,F#", "#literal"]\n${extra}---\n${body}`;
const bytes = (text: string) => new TextEncoder().encode(text);
const error = (name: string) => new DOMException(name, name);

class TestFile implements BrowserFileHandle {
  readonly kind = "file" as const;
  bytes: Uint8Array;
  readError?: string;
  writeHook?: () => Promise<void> | void;
  closeError = false;
  writable = false;
  constructor(public name: string, text: string | Uint8Array) { this.bytes = typeof text === "string" ? bytes(text) : text; }
  async isSameEntry(other: BrowserFileHandle | BrowserDirectoryHandle): Promise<boolean> { return this === other; }
  async getFile(): Promise<File> {
    if (this.readError) throw error(this.readError);
    return new File([this.bytes as Uint8Array<ArrayBuffer>], this.name);
  }
  async createWritable(options?: { mode?: "exclusive" }): Promise<BrowserWritable> {
    if (this.writable && options?.mode === "exclusive") throw error("NoModificationAllowedError");
    this.writable = true;
    let staged = this.bytes;
    return {
      write: async (data) => {
        staged = typeof data === "string" ? bytes(data) : data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
        await this.writeHook?.();
      },
      close: async () => { if (this.closeError) throw error("NotReadableError"); this.bytes = staged; this.writable = false; },
      abort: async () => { this.writable = false; },
    };
  }
  get text(): string { return new TextDecoder().decode(this.bytes); }
}

class TestDirectory implements BrowserDirectoryHandle {
  readonly kind = "directory" as const;
  children = new Map<string, TestDirectory | TestFile>();
  permission: PermissionState = "granted";
  requested = 0;
  enumerationError = false;
  createdFile?: (file: TestFile) => void;
  entriesCalls = 0;
  constructor(public name: string) {}
  async isSameEntry(other: BrowserFileHandle | BrowserDirectoryHandle): Promise<boolean> { return this === other; }
  async queryPermission() { return this.permission; }
  async requestPermission() { this.requested++; this.permission = "granted"; return this.permission; }
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<TestDirectory> {
    let child = this.children.get(name);
    if (!child && options?.create) { child = new TestDirectory(name); this.children.set(name, child); }
    if (!child) throw error("NotFoundError");
    if (!(child instanceof TestDirectory)) throw error("TypeMismatchError");
    return child;
  }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<TestFile> {
    let child = this.children.get(name);
    if (!child && options?.create) { child = new TestFile(name, ""); this.children.set(name, child); this.createdFile?.(child); }
    if (!child) throw error("NotFoundError");
    if (!(child instanceof TestFile)) throw error("TypeMismatchError");
    return child;
  }
  async removeEntry(name: string) { this.children.delete(name); }
  async *entries(): AsyncIterableIterator<[string, TestDirectory | TestFile]> {
    this.entriesCalls++;
    if (this.enumerationError) throw error("NotReadableError");
    yield* this.children;
  }
}

class TestStorage implements BrowserVaultStorage {
  selection?: StoredSelection;
  registry: StoredSelection[] = [];
  records = new Map<string, BrowserDraft>();
  identitiesByScope = new Map<string, import("./browser-files").FileIdentity[]>();
  async identities(scope: string) { return this.identitiesByScope.get(scope) ?? []; }
  async saveIdentities(scope: string, items: import("./browser-files").FileIdentity[]) { this.identitiesByScope.set(scope, items); }
  failWrites = false;
  async loadSelection() { return this.selection; }
  async remember(handle: BrowserDirectoryHandle, id: string) {
    const existing = this.registry.find((entry) => entry.handle === handle);
    const selected = { handle, vaultId: id, directoryId: existing?.directoryId ?? createId() };
    if (!existing) this.registry.push(selected);
    this.selection = selected;
    return selected;
  }
  async drafts(scope: string) { return [...this.records].filter(([key]) => key.startsWith(scope + ":")).map(([, draft]) => structuredClone(draft)); }
  async putDraft(scope: string, draft: BrowserDraft) {
    if (this.failWrites) throw error("QuotaExceededError");
    this.records.set(`${scope}:${draft.draftKey}`, structuredClone(draft));
  }
  async removeMatchingDraft(scope: string, draft: BrowserDraft) {
    const key = `${scope}:${draft.draftKey}`, existing = this.records.get(key);
    if (existing?.body === draft.body && existing.baseHash === draft.baseHash && JSON.stringify(existing.tags) === JSON.stringify(draft.tags)) this.records.delete(key);
  }
}

const locks = new Map<string, Promise<unknown>>();
async function lock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(name) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(task);
  locks.set(name, pending);
  try { return await pending; } finally { if (locks.get(name) === pending) locks.delete(name); }
}

async function fixture(name = "vault", id = vaultId): Promise<TestDirectory> {
  const root = new TestDirectory(name);
  const meta = await root.getDirectoryHandle(".memocard", { create: true });
  meta.children.set("vault.json", new TestFile("vault.json", JSON.stringify({ formatVersion: 1, vaultId: id })));
  const notes = await root.getDirectoryHandle("notes", { create: true });
  notes.children.set(`${noteId}.md`, new TestFile(`${noteId}.md`, source()));
  await root.getDirectoryHandle("assets", { create: true });
  return root;
}

function harness(root: TestDirectory, storage = new TestStorage()) {
  let next: TestDirectory | Error = root;
  let pickerCalls = 0;
  const core = new BrowserVault({ storage, lock, supported: () => true, picker: () => {
    pickerCalls++;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }, decodeImage: async () => undefined });
  return { core, storage, pickerCalls: () => pickerCalls, choose: (value: TestDirectory | Error) => { next = value; } };
}

async function call<T = unknown>(core: BrowserVault, operation: string, params: Record<string, unknown> = {}): Promise<T> {
  const message: BridgeRequest = { version: 1, requestId: createId(), operation, params };
  const reply = await core.request(message);
  if (!reply.ok) throw Object.assign(new Error(reply.error.message), reply.error);
  return reply.data as T;
}

async function open(selected?: TestDirectory, storage?: TestStorage) {
  const root = selected ?? await fixture();
  const value = harness(root, storage);
  await call(value.core, "selectVault", { create: false });
  return { ...value, root, notes: await root.getDirectoryHandle("notes") };
}

function save(note: Note, body = "changed") { return { id: note.id, body, tags: note.tags, baseHash: note.contentHash }; }


describe("independent browser vault", () => {
  it("reuses one scan for a refresh batch and rescans the next query", async () => {
    const h = await open();
    expect(h.notes.entriesCalls).toBe(0);
    await call(h.core, "getStatus");
    expect(h.notes.entriesCalls).toBe(1);
    await Promise.all([
      call(h.core, "queryNotes"),
      call(h.core, "listTags"),
      call(h.core, "listFolders"),
    ]);
    expect(h.notes.entriesCalls).toBe(1);
    await call(h.core, "queryNotes");
    expect(h.notes.entriesCalls).toBe(2);
  });

  it("reuses exact-hash parse results across scans and drops deleted paths", async () => {
    const root = await fixture(), storage = new TestStorage();
    let parses = 0;
    const core = new BrowserVault({ storage, lock, supported: () => true, picker: async () => root,
      decodeImage: async () => undefined, parseLegacy: async (...args) => { parses++; return parseBrowserNote(...args); } });
    await call(core, "selectVault");
    await call(core, "getStatus");
    expect(parses).toBe(1);
    await call(core, "queryNotes");
    await call(core, "queryNotes");
    expect(parses).toBe(1);

    const notes = await root.getDirectoryHandle("notes");
    const file = await notes.getFileHandle(`${noteId}.md`);
    file.bytes = bytes(source(noteId, "changed"));
    await call(core, "queryNotes");
    expect(parses).toBe(2);
    notes.children.delete(`${noteId}.md`);
    await call(core, "queryNotes");
    notes.children.set(`${noteId}.md`, file);
    await call(core, "queryNotes");
    expect(parses).toBe(3);
  });

  it("enters picker synchronously and creates an empty vault that can be opened after reload", async () => {
    const root = new TestDirectory("new vault"), h = harness(root);
    const pending = call(h.core, "selectVault", { create: true });
    expect(h.pickerCalls()).toBe(1);
    await pending;
    expect((await call<VaultStatus>(h.core, "getStatus")).connected).toBe(true);
    const restored = harness(root, h.storage);
    expect((await call<VaultStatus>(restored.core, "getStatus")).vaultName).toBe("new vault");
    expect(restored.pickerCalls()).toBe(0);
    const metadata = await (await root.getDirectoryHandle(".memocard")).getFileHandle("vault.json");
    expect(JSON.parse(metadata.text).formatVersion).toBe(2);
  });

  it("rejects creating in nonempty folders and preserves the previous selection on cancel or invalid selection", async () => {
    const h = await open(), before = h.core.binding;
    h.choose(error("AbortError"));
    expect(await call(h.core, "selectVault", {})).toEqual({ cancelled: true, diagnostic: "选择文件夹并授权 / AbortError" });
    const nonempty = new TestDirectory("documents");
    nonempty.children.set("existing.txt", new TestFile("existing.txt", "keep"));
    h.choose(nonempty);
    await expect(call(h.core, "selectVault", { create: true })).rejects.toMatchObject({ code: "VAULT_NOT_EMPTY" });
    expect(h.core.binding).toBe(before);
    expect((await call<VaultStatus>(h.core, "getStatus")).vaultName).toBe("vault");
  });

  it("reports the failing opening stage without leaking file paths and preserves the active vault", async () => {
    const h = await open(), before = h.core.binding;
    h.choose(error("NotAllowedError"));
    await expect(call(h.core, "selectVault", {})).rejects.toMatchObject({
      code: "UNAUTHORIZED", message: expect.stringContaining("选择文件夹并授权 / NotAllowedError"),
    });
    expect(h.core.binding).toBe(before);
  });

  it("distinguishes handle persistence failure from picker failure", async () => {
    const storage = new TestStorage();
    storage.remember = async () => { throw error("DataCloneError"); };
    const h = harness(await fixture(), storage);
    await expect(call(h.core, "selectVault", {})).rejects.toMatchObject({
      message: expect.stringContaining("保存文件夹授权到浏览器 / DataCloneError"),
    });
    expect(h.core.binding).toBeNull();
  });

  it("matches the shared Swift contract and hashes raw CRLF bytes", async () => {
    const fixturePath = new URL("../../../tests/fixtures/", import.meta.url);
    const bridge = JSON.parse(readFileSync(new URL("bridge-v1.json", fixturePath), "utf8"));
    const raw = readFileSync(new URL(`vault/notes/${noteId}.md`, fixturePath));
    expect((await parseBrowserNote(raw, `notes/${noteId}.md`, vaultId)).note).toEqual(bridge.note.data);
    const crlf = bytes(source().replace(/\n/g, "\r\n"));
    const parsed = (await parseBrowserNote(crlf, "notes/renamed.md", vaultId)).note;
    expect(parsed.body).toBe("中文 test\n");
    expect(parsed.contentHash).toBe(createHash("sha256").update(crlf).digest("hex"));
  });

  it.each([
    source().replace("2026-09-28T04:00:00Z", "2026-02-30T04:00:00Z"),
    source().replace("2026-09-28T04:00:00Z", "2026-09-28T24:00:00Z"),
    source(noteId, "", "deletedAt: ''\n"),
    source(noteId, "", "id: different\n"),
    source().replace('["日常", "machine learning", "C#,F#", "#literal"]', "[yes]"),
    "\ufeff" + source(),
  ])("keeps malformed metadata out of normal notes", async (raw) => {
    await expect(parseBrowserNote(bytes(raw), "notes/bad.md", vaultId)).rejects.toHaveProperty("code");
  });

  it("preserves unknown YAML data, original createdAt, exact tag strings, and external nested rename", async () => {
    const h = await open();
    const original = await h.notes.getFileHandle(`${noteId}.md`);
    original.bytes = bytes(source(noteId, "before", "custom: &custom\n  enabled: yes\n  value: 3\nother: *custom\ndeletedAt: null\n"));
    const note = await call<Note>(h.core, "getNote", { id: noteId });
    const nested = await h.notes.getDirectoryHandle("folder", { create: true });
    h.notes.children.delete(`${noteId}.md`); nested.children.set("renamed.md", original);
    const saved = await call<Note>(h.core, "saveNote", save(note));
    expect(saved.relativePath).toBe("notes/folder/renamed.md");
    expect(saved.createdAt).toBe(note.createdAt);
    expect(saved.tags).toEqual(note.tags);
    expect(original.text).toContain("custom: &custom");
    expect(original.text).toContain("other: *custom");
    expect(original.text).toContain("enabled: yes");
    expect(saved.body).toBe("changed");
  });

  it("does not overwrite an external change and retains the local draft", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`);
    file.bytes = bytes(source(noteId, "external"));
    await expect(call(h.core, "saveNote", save(note, "my draft"))).rejects.toMatchObject({ code: "HASH_CONFLICT" });
    expect(file.text).toContain("external");
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("my draft");
  });

  it("rechecks source after staging and aborts without clobbering an external write", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`);
    file.writeHook = () => { file.bytes = bytes(source(noteId, "external while staging")); };
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "HASH_CONFLICT" });
    expect(file.text).toContain("external while staging");
    expect(file.writable).toBe(false);
  });

  it("does not resurrect a physically deleted note", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    h.notes.children.delete(`${noteId}.md`);
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "NOTE_NOT_FOUND" });
    expect(h.notes.children.size).toBe(0);
  });

  it("excludes all duplicate IDs and pauses writes for incomplete scans", async () => {
    const h = await open();
    h.notes.children.set("copy.md", new TestFile("copy.md", source(noteId.toUpperCase())));
    const page = await call<NotePage>(h.core, "queryNotes");
    expect(page.notes).toEqual([]);
    expect(page.coverage).toMatchObject({ complete: false, issues: 2 });
    await expect(call(h.core, "getNote", { id: noteId })).rejects.toMatchObject({ code: "DUPLICATE_ID" });
    await expect(call(h.core, "saveNote", { id: secondId, body: "new", tags: [], baseHash: null })).rejects.toMatchObject({ code: "SCAN_INCOMPLETE" });
  });

  it("reports unreadable and missing metadata as incomplete rather than empty or deleted", async () => {
    const h = await open();
    (await h.notes.getFileHandle(`${noteId}.md`)).readError = "NotReadableError";
    h.notes.children.set("plain.md", new TestFile("plain.md", "external note without id"));
    expect((await call<NotePage>(h.core, "queryNotes")).coverage).toMatchObject({ complete: false, pending: 1, issues: 1 });
    await expect(call(h.core, "getNote", { id: noteId })).rejects.toMatchObject({ code: "NOTE_UNAVAILABLE" });
  });

  it("keeps drafts available after permission loss and asks for permission only on explicit reauthorization", async () => {
    const h = await open(), binding = h.core.binding;
    h.root.permission = "prompt";
    const status = await call<VaultStatus>(h.core, "getStatus");
    expect(status).toMatchObject({ connected: false, vaultName: "vault", syncState: "unauthorized" });
    expect(h.root.requested).toBe(0);
    await call(h.core, "saveDraft", { id: secondId, body: "offline", tags: [], baseHash: null, vaultBinding: binding });
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("offline");
    await call(h.core, "reauthorizeVault");
    expect(h.root.requested).toBe(1);
    expect(h.core.binding).toBe(binding);
  });

  it("isolates restored folders with the same vaultId and rejects stale editor writes after switching", async () => {
    const h = await open(), firstBinding = h.core.binding;
    await call(h.core, "saveDraft", { id: secondId, body: "first folder", tags: [], baseHash: null, vaultBinding: firstBinding });
    const clone = await fixture("restored clone"); h.choose(clone);
    await call(h.core, "selectVault");
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts).toEqual([]);
    await expect(call(h.core, "saveDraft", { id: secondId, body: "stale", tags: [], baseHash: null, vaultBinding: firstBinding })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(h.core.asset("assets/a.png", firstBinding!)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    h.choose(h.root); await call(h.core, "selectVault");
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("first folder");
  });

  it("rejects a queued save if selection changes while its staged write is in progress", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`), original = file.text;
    const clone = await fixture("other");
    file.writeHook = async () => { h.choose(clone); await call(h.core, "selectVault"); };
    await expect(call(h.core, "saveNote", { ...save(note), vaultBinding: h.core.binding })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(file.text).toBe(original);
    expect((await (await clone.getDirectoryHandle("notes")).getFileHandle(`${noteId}.md`)).text).toBe(source());
  });

  it("keeps separate drafts for two tabs resuming the same recovered draft", async () => {
    const h = await open();
    const original = await call<BrowserDraft>(h.core, "saveDraft", { id: secondId, body: "recover", tags: [], baseHash: null });
    const one = harness(h.root, h.storage), two = harness(h.root, h.storage);
    await call(one.core, "getStatus"); await call(two.core, "getStatus");
    await call(one.core, "saveDraft", { ...original, body: "tab one", vaultBinding: one.core.binding });
    await call(two.core, "saveDraft", { ...original, body: "tab two", vaultBinding: two.core.binding });
    const drafts = (await call<{ drafts: BrowserDraft[] }>(one.core, "getDrafts")).drafts;
    expect(drafts.map((draft) => draft.body).sort()).toEqual(["recover", "tab one", "tab two"]);
    await call(one.core, "saveNote", { ...original, body: "tab one", vaultBinding: one.core.binding });
    expect((await call<{ drafts: BrowserDraft[] }>(two.core, "getDrafts")).drafts.map((draft) => draft.body)).toEqual(["tab two"]);
  });

  it("requires durable drafts before touching source and preserves them when closing the stream fails", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`), original = file.text;
    h.storage.failWrites = true;
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "STORAGE_FULL" });
    expect(file.text).toBe(original);
    h.storage.failWrites = false; file.closeError = true;
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "FILE_PENDING" });
    expect(file.text).toBe(original);
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("changed");
  });

  it("removes only the new empty placeholder after ordinary commit failure, retaining its draft", async () => {
    const h = await open();
    h.notes.createdFile = (file) => { file.closeError = true; };
    await expect(call(h.core, "saveNote", { id: secondId, body: "new draft", tags: [], baseHash: null })).rejects.toMatchObject({ code: "FILE_PENDING" });
    expect(h.notes.children.has(`${secondId}.md`)).toBe(false);
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("new draft");
  });

  it("serializes two tabs saving the same base version and keeps the losing draft", async () => {
    const h = await open(), other = harness(h.root, h.storage);
    await call(other.core, "getStatus");
    const note = await call<Note>(h.core, "getNote", { id: noteId });
    const results = await Promise.allSettled([
      call(h.core, "saveNote", save(note, "first tab")),
      call(other.core, "saveNote", save(note, "second tab")),
    ]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "HASH_CONFLICT" } });
    expect((await call<Note>(h.core, "getNote", { id: noteId })).body).toBe("first tab");
    expect((await call<{ drafts: BrowserDraft[] }>(other.core, "getDrafts")).drafts.map((draft) => draft.body)).toEqual(["second tab"]);
  });

  it("matches Chinese/case-insensitive substrings, AND tags, date interval, and invalidates stale cursors", async () => {
    const h = await open();
    h.notes.children.set("second.md", new TestFile("second.md", source(secondId, "中文 TEST two").replaceAll("2026-09-28T04:00:00Z", "2026-09-29T04:00:00Z")));
    expect((await call<NotePage>(h.core, "queryNotes", { query: "中文 TEST", tags: ["日常", "C#,F#"], from: "2026-09-28T04:00:00Z", to: "2026-09-29T04:00:00Z" })).notes.map((note) => note.id)).toEqual([noteId]);
    const first = await call<NotePage>(h.core, "queryNotes", { limit: 1 });
    expect(first.notes[0]?.id).toBe(secondId);
    expect((await call<NotePage>(h.core, "queryNotes", { limit: 1, cursor: first.nextCursor })).notes[0]?.id).toBe(noteId);
    (await h.notes.getFileHandle(`${noteId}.md`)).bytes = bytes(source(noteId, "updated"));
    await expect(call(h.core, "queryNotes", { limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ code: "STALE_CURSOR" });
  });

  it("invalidates pagination when switching to an identical restored folder with the same vaultId", async () => {
    const h = await open();
    h.notes.children.set("second.md", new TestFile("second.md", source(secondId)));
    const first = await call<NotePage>(h.core, "queryNotes", { limit: 1 });
    const clone = await fixture("restored clone");
    (await clone.getDirectoryHandle("notes")).children.set("second.md", new TestFile("second.md", source(secondId)));
    h.choose(clone); await call(h.core, "selectVault");
    await expect(call(h.core, "queryNotes", { limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ code: "STALE_CURSOR" });
  });

  it("imports image relative to the moved note and refuses asset traversal/non-images", async () => {
    const h = await open(), file = await h.notes.getFileHandle(`${noteId}.md`);
    const nested = await h.notes.getDirectoryHandle("folder", { create: true });
    h.notes.children.delete(`${noteId}.md`); nested.children.set("renamed.md", file);
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8]);
    const attachment = await call<{ relativePath: string; markdownPath: string }>(h.core, "importAttachment", { name: "picture.png", base64: Buffer.from(png).toString("base64"), noteId });
    expect(attachment.markdownPath).toBe(`../../${attachment.relativePath}`);
    expect((await h.core.asset(attachment.relativePath)).type).toBe("image/png");
    await expect(h.core.asset("assets/../.memocard/vault.json")).rejects.toMatchObject({ code: "PATH_NOT_ALLOWED" });
    await expect(call(h.core, "importAttachment", { name: "fake.png", base64: btoa("not an image"), noteId })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
  });

  it("requires successful image decoding before creating an attachment file", async () => {
    const root = await fixture();
    const core = new BrowserVault({ storage: new TestStorage(), lock, supported: () => true, picker: async () => root,
      decodeImage: async () => { throw new Error("truncated image"); } });
    await call(core, "selectVault");
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8]);
    await expect(call(core, "importAttachment", { name: "broken.png", base64: Buffer.from(png).toString("base64"), noteId })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    expect((await root.getDirectoryHandle("assets")).children.size).toBe(0);
  });
});

it("lists empty nested folders and filters descendants without prefix collisions", async () => {
  const { core, notes } = await open();
  const folder = await notes.getDirectoryHandle("工作", { create: true });
  await folder.getDirectoryHandle("空目录", { create: true });
  const child = await folder.getDirectoryHandle("项目", { create: true });
  child.children.set("nested.md", new TestFile("nested.md", source(secondId)));
  const result = await call<{folders: string[]}>(core, "listFolders");
  expect(result.folders).toEqual(["notes", "notes/工作", "notes/工作/空目录", "notes/工作/项目"]);
  const page = await call<NotePage>(core, "queryNotes", { folder: "notes/工作" });
  expect(page.notes.map(note => note.id)).toEqual([secondId]);
  expect((await call<NotePage>(core, "queryNotes", { folder: "notes/工" })).notes).toEqual([]);
  await expect(call(core, "queryNotes", { folder: "notes/../assets" })).rejects.toBeTruthy();
});

it("creates new notes and attachment references in the selected nested folder", async () => {
  const h = await open();
  const work = await h.notes.getDirectoryHandle("工作", { create: true });
  const project = await work.getDirectoryHandle("项目", { create: true });
  const path = `notes/工作/项目/${secondId}.md`;
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8]);
  const image = await call<{markdownPath: string; relativePath: string; notePath: string}>(h.core, "importAttachment", {
    name: "image.png", base64: Buffer.from(png).toString("base64"), noteId: secondId, notePath: path,
  });
  expect(image.notePath).toBe(path);
  expect(image.markdownPath).toBe(`../../../${image.relativePath}`);
  const saved = await call<Note>(h.core, "saveNote", { id: secondId, body: `![图片](${image.markdownPath})`, tags: [], baseHash: null, relativePath: path });
  expect(saved.relativePath).toBe(path);
  expect((await project.getFileHandle(`${secondId}.md`)).text).toContain(image.markdownPath);
  expect(h.notes.children.has(`${secondId}.md`)).toBe(false);
});

it("keeps the draft when a destination folder disappears and never falls back to root", async () => {
  const h = await open();
  const save = { id: secondId, body: "保留草稿", tags: [], baseHash: null, relativePath: `notes/missing/${secondId}.md` };
  await expect(call(h.core, "saveNote", save)).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND" });
  expect(h.notes.children.has(`${secondId}.md`)).toBe(false);
  const result = await call<{drafts: BrowserDraft[]}>(h.core, "getDrafts");
  expect(result.drafts[0]?.body).toBe("保留草稿");
  await expect(call(h.core, "saveNote", { ...save, relativePath: "notes/../outside.md" })).rejects.toMatchObject({ code: "PATH_NOT_ALLOWED" });
});

describe("Obsidian shared folders", () => {
  it("opens plain files, preserves custom properties byte-for-byte, follows rename and rejects stale writes", async () => {
    const root = new TestDirectory("Obsidian");
    const header = '---\r\nid: my-own-id\r\ncreatedAt: yesterday\r\n# Keep this comment\r\naliases: [Example]\r\ntags: [work]\r\n---\r\n';
    const file = new TestFile("Example.md", header + "Original #inline/topic\r\n");
    root.children.set(file.name, file);
    const plain = new TestFile("Plain.md", "No properties"); root.children.set(plain.name, plain);
    const h = harness(root); await call(h.core, "selectVault");
    const page = await call<NotePage>(h.core, "queryNotes");
    expect(page.coverage.complete).toBe(true);
    const note = page.notes.find(note => note.relativePath === "Example.md")!;
    expect(note.tags).toEqual(["work", "inline/topic"]);
    expect(file.text).toBe(header + "Original #inline/topic\r\n");
    const saved = await call<Note>(h.core, "saveNote", { id: note.id, body: "Updated #inline/topic\r\n", tags: note.tags, baseHash: note.contentHash });
    expect(file.text).toBe(header + "Updated #inline/topic\r\n");
    const folder = await root.getDirectoryHandle("Projects", { create: true });
    root.children.delete(file.name); folder.children.set("Renamed.md", file);
    const reopened = harness(root, h.storage); await call(reopened.core, "selectVault");
    const moved = await call<Note>(reopened.core, "getNote", { id: note.id });
    expect(moved.relativePath).toBe("Projects/Renamed.md");
    file.bytes = bytes(header + "External edit");
    await expect(call(reopened.core, "saveNote", { id: note.id, body: "Stale", tags: note.tags, baseHash: saved.contentHash })).rejects.toMatchObject({ code: "HASH_CONFLICT" });
    expect(file.text).toBe(header + "External edit");
    const plainNote = page.notes.find(note => note.relativePath === "Plain.md")!;
    await call(reopened.core, "saveNote", { id: plainNote.id, body: "Still plain", tags: [], baseHash: plainNote.contentHash });
    expect(plain.text).toBe("Still plain");
  });

  it("resolves root, relative and short-name links, rejecting ambiguous and private targets", async () => {
    const root = new TestDirectory("Obsidian");
    const folder = await root.getDirectoryHandle("Projects", { create: true });
    folder.children.set("Target.md", new TestFile("Target.md", "Target"));
    folder.children.set("pic.png", new TestFile("pic.png", "image"));
    const h = harness(root); await call(h.core, "selectVault");
    expect(await call(h.core, "resolveLink", { target: "Target", sourcePath: "Home.md", wiki: true })).toMatchObject({ kind: "note", path: "Projects/Target.md" });
    expect(await call(h.core, "resolveLink", { target: "pic.png", sourcePath: "Projects/Target.md", wiki: false })).toEqual({ kind: "image", path: "Projects/pic.png" });
    const second = await root.getDirectoryHandle("Other", { create: true }); second.children.set("Target.md", new TestFile("Target.md", "Other"));
    await expect(call(h.core, "resolveLink", { target: "Target", sourcePath: "Home.md", wiki: true })).rejects.toMatchObject({ code: "AMBIGUOUS_LINK" });
    await expect(h.core.asset(".obsidian/secret.png")).rejects.toMatchObject({ code: "PATH_NOT_ALLOWED" });
    await expect(call(h.core, "resolveLink", { target: "../../secret.png", sourcePath: "Home.md", wiki: true })).rejects.toMatchObject({ code: "LINK_NOT_FOUND" });
  });
});

it("creates readable plain Markdown and serializes simultaneous first scans", async () => {
  const root = new TestDirectory("shared"), h = harness(root);
  root.children.set("A.md", new TestFile("A.md", "same"));
  root.children.set("B.md", new TestFile("B.md", "same"));
  await call(h.core, "selectVault");
  const [a, b] = await Promise.all([call<NotePage>(h.core, "queryNotes"), call<NotePage>(h.core, "queryNotes")]);
  expect(a.notes.map(note => note.id)).toEqual(b.notes.map(note => note.id));
  expect(new Set(a.notes.map(note => note.id)).size).toBe(2);
  const note = await call<Note>(h.core, "saveNote", { id: secondId, body: "# 我的记录\n\n正文", tags: [], baseHash: null });
  expect(note.relativePath).toBe(`我的记录-${secondId.slice(0, 8)}.md`);
  expect((await root.getFileHandle(note.relativePath)).text).toBe("# 我的记录\n\n正文");
});

it("changes only the YAML tags property and leaves inline tags in the body", async () => {
  const root = new TestDirectory("shared"), h = harness(root);
  const file = new TestFile("A.md", '---\r\n# header\r\ntags: [old]\r\ncustom: "keep spelling"\r\n---\r\nBody #inline');
  root.children.set("A.md", file);
  await call(h.core, "selectVault");
  const note = (await call<NotePage>(h.core, "queryNotes")).notes[0];
  const saved = await call<Note>(h.core, "saveNote", { id: note.id, body: note.body, tags: ["new", "inline"], baseHash: note.contentHash });
  expect(file.text).toBe('---\r\n# header\r\ntags: ["new"]\r\ncustom: "keep spelling"\r\n---\r\nBody #inline');
  expect(saved.tags).toEqual(["new", "inline"]);
});

it("includes descendants in tag queries and counts each note once per ancestor", async () => {
  const h = await open();
  await call(h.core, "saveNote", { id: secondId, body: "Nested", tags: ["工作", "工作/项目/设计", "工作/项目/开发"], baseHash: null });
  await call(h.core, "saveNote", { id: createId(), body: "Boundary", tags: ["工作室"], baseHash: null });
  for (const tag of ["工作", "工作/项目", "工作/项目/设计"]) {
    const page = await call<NotePage>(h.core, "queryNotes", { tags: [tag] });
    expect(page.notes.map(note => note.id)).toEqual([secondId]);
  }
  const result = await call<{ tags: { name: string; count: number }[] }>(h.core, "listTags");
  expect(result.tags).toContainEqual({ name: "工作/项目", count: 1 });
  expect(result.tags).toContainEqual({ name: "工作", count: 1 });
});
