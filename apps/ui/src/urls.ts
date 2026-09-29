import { isLocalWeb } from "./client-mode";

export function externalUrl(raw: string): string | null {
  if ([...raw].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(raw);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function assetUrl(raw: string, notePath = "notes/note.md"): string | null {
  const prefix = "memocard-asset://vault/";
  const absolute = raw.startsWith(prefix);
  const source = absolute ? raw.slice(prefix.length) : raw;
  if (!source || source.startsWith("/") || /[\\?#:]/.test(source)) return null;
  const noteParts = notePath.split("/");
  if (!absolute && (noteParts.some((part) => !part || part === "." || part === ".." || part.includes("\\")))) return null;
  const parts = absolute ? [] : noteParts.slice(0, -1);
  for (const encoded of source.split("/")) {
    let part: string;
    try { part = decodeURIComponent(encoded); } catch { return null; }
    if (!part || /[/\\]/.test(part) || [...part].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null;
    // Literal relative navigation is Markdown syntax; encoded navigation is not accepted.
    if (part === "." || part === "..") {
      if (absolute || part !== encoded) return null;
      if (part === ".." && !parts.pop()) return null;
    } else parts.push(part);
  }
  const path = parts.join("/");
  if (!parts.length || parts.some(part => part.startsWith("."))) return null;
  if (!/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(path)) return null;
  return `${isLocalWeb ? "/api/assets/" : prefix}${parts.map(encodeURIComponent).join("/")}`;
}

export function internalTarget(raw: string): boolean {
  return !!raw && !raw.startsWith("//") && !/[\\:]/.test(raw) && ![...raw].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}
