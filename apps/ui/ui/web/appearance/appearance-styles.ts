// Keep styles with their lazy module so a failed stylesheet preload cannot
// leave Vite reporting a successful retry with the styles still missing.
export function applyAppearanceStyles(name: string, css: string) {
  const existing = document.head.querySelector<HTMLStyleElement>(`style[data-workspace-style="${name}"]`);
  const style = existing ?? document.createElement("style");
  style.textContent = css;
  if (!existing) {
    style.dataset.workspaceStyle = name;
    document.head.append(style);
  }
}
