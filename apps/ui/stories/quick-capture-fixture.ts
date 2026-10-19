import type { Note } from "@memocard/contracts";
import type { Attachment, Draft } from "../src/bridge";
import type { Capture } from "../src/quick-capture-draft";

export const captureVaultId = "storybook-quick-capture";
export const captureVaultBinding = "storybook-capture-binding";
export const captureAssetPath = "assets/quick-capture.png";
export const restoredCapture: Capture = {
  id: "restored-capture",
  text: "关闭页面后继续这条想法",
  tags: ["工作"],
  images: [{ relativePath: captureAssetPath, markdownPath: "../assets/quick-capture.png" }],
  relativePath: "notes/restored-capture.md",
};

type Call = { operation: string; params: Record<string, unknown> };
type Save = Draft & { vaultId: string };

function savedNote(draft: Save): Note {
  return {
    id: draft.id,
    title: "快速记录示例",
    body: draft.body,
    tags: [...new Set([...draft.tags, ...draft.inheritedTags ?? []])],
    createdAt: "2026-10-19T08:00:00Z",
    updatedAt: "2026-10-19T08:00:00Z",
    contentHash: `storybook-${draft.id}`,
    relativePath: draft.relativePath!,
    sourceUrl: `memocard://note/${draft.id}`,
  };
}

// These are the component's real operations, backed only by this story's memory.
// No fallback can reach a vault, a file picker or the local API.
export function createCaptureFixture(mode: "ready" | "retry" | "pending" = "ready") {
  const calls: Call[] = [];
  let failNextSave = mode === "retry";
  let completeSave: (() => void) | undefined;
  return {
    calls,
    completeSave: () => completeSave?.(),
    request(operation: string, params: Record<string, unknown>): unknown {
      if (params.vaultId !== captureVaultId || params.vaultBinding !== captureVaultBinding) {
        throw new Error("Storybook fixture cannot access another notebook.");
      }
      calls.push({ operation, params: structuredClone(params) });
      switch (operation) {
        case "pickImage":
          return { relativePath: captureAssetPath, markdownPath: "../assets/quick-capture.png", notePath: params.notePath as string } satisfies Attachment;
        case "saveNote": {
          const draft = params as Save;
          if (failNextSave) { failNextSave = false; throw new Error("磁盘只读（内存示例）"); }
          if (mode === "pending") return new Promise<Note>(resolve => {
            completeSave = () => { completeSave = undefined; resolve(savedNote(draft)); };
          });
          return savedNote(draft);
        }
        case "saveDraft":
          return { ...params, draftKey: "storybook-page-draft", revision: "storybook-revision-1" };
        default:
          throw new Error(`Storybook capture fixture has no operation: ${operation}`);
      }
    },
  };
}

// A generated PNG exercises the production Blob/image lifecycle without requests.
export async function captureImageBlob(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 320;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#edf4f1";
  context.fillRect(0, 0, 480, 320);
  context.fillStyle = "#a8c7b4";
  context.fillRect(32, 32, 416, 256);
  context.fillStyle = "#fffef5";
  context.fillRect(96, 60, 288, 200);
  context.fillStyle = "#243c31";
  context.font = "24px sans-serif";
  context.fillText("A small idea", 120, 116);
  context.fillRect(120, 148, 192, 8);
  context.fillRect(120, 176, 144, 8);
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error("Cannot create the Storybook image fixture."));
  }, "image/png"));
}
