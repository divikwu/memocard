/** Resolve exact relative/root paths before the Obsidian short-name lookup; never choose an ambiguous match. */
export function linkCandidates(target: string, sourcePath: string, paths: string[], wiki: boolean): string[] {
  const raw = target.split("#")[0];
  let decoded: string;
  try { decoded = wiki ? raw : decodeURIComponent(raw); } catch { return []; }
  if (!decoded || (/[\\:]/.test(decoded) || [...decoded].some(char => char.charCodeAt(0) < 32))) return [];
  const normalize = (value: string): string | undefined => {
    const parts: string[] = [];
    for (const part of value.split("/")) {
      if (part === "." || !part) continue;
      if (part === "..") { if (!parts.pop()) return; }
      else { if (part.startsWith(".")) return; parts.push(part); }
    }
    return parts.join("/");
  };
  const directory = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1) : "";
  const roots = wiki ? [decoded, directory + decoded] : [directory + decoded, decoded];
  for (const root of roots) {
    const path = normalize(root);
    if (!path) continue;
    const exact = paths.filter(item => item === path);
    if (exact.length) return exact;
    const markdown = paths.filter(item => item === `${path}.md`);
    if (markdown.length) return markdown;
  }
  if (!wiki || decoded.startsWith("/") || decoded.split("/").some(part => part === ".." || part.startsWith("."))) return [];
  const exact = paths.filter(path => path.endsWith(`/${decoded}`));
  return exact.length ? exact : paths.filter(path => path.endsWith(`/${decoded}.md`));
}
