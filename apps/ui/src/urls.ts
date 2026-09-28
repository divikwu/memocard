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
  if (!absolute && (noteParts[0] !== "notes" || noteParts.length < 2 || noteParts.some((part) => !part || part === "." || part === ".." || part.includes("\\")))) return null;
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
  if (parts[0] !== "assets" || parts.length < 2) return null;
  if (!/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(path)) return null;
  return `${isLocalWeb ? "/api/assets/" : prefix}${parts.map(encodeURIComponent).join("/")}`;
}
