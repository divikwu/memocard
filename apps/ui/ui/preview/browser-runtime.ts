export const getBrowserVaultBinding = () => "ui-preview-only";
export async function readBrowserAsset(path: string) {
  if (path === "assets/spacing-wide.png" || path === "assets/spacing-detail.png") {
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 320;
    const context = canvas.getContext("2d")!;
    context.fillStyle = path.endsWith("wide.png") ? "#e5e7eb" : "#cbd5e1";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#94a3b8";
    context.strokeRect(24, 24, 592, 272);
    context.fillStyle = "#475569";
    context.font = "24px sans-serif"; context.textAlign = "center";
    context.fillText(path.endsWith("wide.png") ? "模拟图片 A · 640 × 320" : "模拟图片 B · 640 × 320", 320, 168);
    return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
  }
  if (path !== "assets/loading-preview.png") throw new Error("模拟附件尚未下载。");
  await new Promise(resolve => setTimeout(resolve, 2000));
  const response = await fetch("/favicon.png");
  return response.blob();
}
