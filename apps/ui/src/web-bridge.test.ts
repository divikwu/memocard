// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBridge, createWebTransport, imageBase64 } from "./bridge";

const response = (data: unknown = {}, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => window.history.replaceState(null, "", "#/notes"));
afterEach(() => vi.restoreAllMocks());

describe("local web bridge", () => {
  it("removes the launch credential before authenticating and shares one session handshake", async () => {
    window.history.replaceState(null, "", "#/connect?token=one-time-secret");
    let authenticate!: (value: Response) => void;
    const session = new Promise<Response>((resolve) => { authenticate = resolve; });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => path === "/api/session" ? session : response({ ok: true, data: { connected: true } }));
    const call = createBridge(createWebTransport(fetcher));
    expect(window.location.hash).toBe("#/notes");
    const first = call("getStatus");
    const second = call("getEnvironment");
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledWith("/api/session", expect.objectContaining({ credentials: "same-origin", body: '{"token":"one-time-secret"}' }));
    authenticate(response());
    await Promise.all([first, second]);
    expect(fetcher.mock.calls.filter(([path]) => path === "/api/session")).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([path]) => path === "/api/bridge")).toHaveLength(2);
  });

  it("uses the current HttpOnly session on reload and sends the shared write contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ ok: true, data: { saved: true } }));
    const params = { id: "stable-id", body: "今天的记录", baseHash: null, tags: ["生活"] };
    await expect(createBridge(createWebTransport(fetcher))("saveNote", params)).resolves.toEqual({ saved: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [path, options] = fetcher.mock.calls[0];
    expect(path).toBe("/api/bridge");
    expect(options).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store" });
    expect(JSON.parse(options?.body as string)).toEqual({ version: 1, requestId: expect.any(String), operation: "saveNote", params });
  });

  it("rejects a revoked launch token without issuing a note request", async () => {
    window.history.replaceState(null, "", "#/connect?token=expired");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    const call = createBridge(createWebTransport(fetcher));
    await expect(call("getNote", { id: "note" })).rejects.toMatchObject({ code: "WEB_UNAUTHORIZED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#/notes");
  });

  it("reports stopped Mac app and permits a later retry without claiming a save", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(response({ ok: true, data: { connected: true } }));
    const call = createBridge(createWebTransport(fetcher));
    await expect(call("saveNote", { body: "retain me" })).rejects.toMatchObject({ code: "BRIDGE_UNAVAILABLE", retryable: true });
    await expect(call("getStatus")).resolves.toEqual({ connected: true });
  });

  it("preserves the native conflict response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ ok: false, error: { code: "REVISION_CONFLICT", message: "文件已更新", retryable: false } }));
    await expect(createBridge(createWebTransport(fetcher))("saveNote")).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("uploads selected images through importAttachment with the original note ID", async () => {
    const file = new File(["image-bytes"], "照片.png", { type: "image/png" });
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, "files", { value: [file] });
      this.dispatchEvent(new Event("change"));
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ ok: true, data: { markdownPath: "../assets/test.png" } }));
    await expect(createBridge(createWebTransport(fetcher))("pickImage", { noteId: "stable-id" })).resolves.toEqual({ markdownPath: "../assets/test.png" });
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toMatchObject({ operation: "importAttachment", params: { noteId: "stable-id", name: "照片.png", base64: btoa("image-bytes") } });
  });

  it("handles picker cancellation without a request", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) { this.dispatchEvent(new Event("cancel")); });
    const fetcher = vi.fn<typeof fetch>();
    await expect(createBridge(createWebTransport(fetcher))("pickImage")).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses unsupported or oversized images before reading and uploading", async () => {
    await expect(imageBase64(new File(["x"], "script.svg"))).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    const large = new File(["x"], "large.png");
    Object.defineProperty(large, "size", { value: 20 * 1024 * 1024 + 1 });
    await expect(imageBase64(large)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("opens only safe links and does not send browser links to the native core", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const fetcher = vi.fn<typeof fetch>();
    const call = createBridge(createWebTransport(fetcher));
    await call("openExternal", { url: "https://example.com/note" });
    expect(open).toHaveBeenCalledWith("https://example.com/note", "_blank", "noopener,noreferrer");
    await expect(call("openExternal", { url: "javascript:alert(1)" })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(open).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
