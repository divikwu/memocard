import type { ContentType, Note } from "@memocard/contracts";
import { tagKey } from "./inline-tags";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { unified } from "unified";
import { wikiMarkdown } from "./wiki-markdown";
import { mayContainMarkdownImage } from "./markdown-image-hint";
import { request } from "./bridge";
import { imageSource, resolvedImageURL, type ResolvedLink } from "./vault-links";
import { markdownSchema, markdownTarget } from "./markdown-schema";

type ImageNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: ImageNode[] };
const imageParser = unified().use(remarkParse).use(remarkGfm).use(wikiMarkdown).use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeSanitize, markdownSchema);
type PreviewImage = { source: string; alt: string };
type Analysis = { type: ContentType; images: PreviewImage[] };
export async function analyzeNoteContent(note: Pick<Note, "body" | "tags" | "relativePath" | "cardPreview" | "contentTypeOverride"> & {vaultBinding?: string}): Promise<Analysis> {
  const { body = "", tags = [], relativePath, cardPreview, contentTypeOverride } = note;
  const images = new Map<string, PreviewImage>();
  if (!cardPreview?.images.length && !mayContainMarkdownImage(body)) {
    return { type: contentTypeOverride ?? "text", images: [] };
  }
  const sameFilename = new Map<string, string[]>();
  const deferred = new Map<string, {target: string; sourcePath: string; wiki: boolean}>();
  function addImage(target: string, alt: string, wiki = false) {
    const source = imageSource(target, relativePath, wiki);
    if (!source || images.has(source)) return;
    images.set(source, { source, alt });
    const filename = (wiki ? target : decodeURIComponent(target)).split("/").at(-1)!;
    const group = sameFilename.get(filename);
    if (group) group.push(source); else sameFilename.set(filename, [source]);
    if (source.startsWith("memocard-resolve:")) deferred.set(source, { target, sourcePath: relativePath, wiki });
  }
  for (const path of cardPreview?.images ?? []) addImage(path, "笔记封面");
  const tagNames = new Set(tags.map(tagKey));
  const characterCount = (text: string) => Array.from(text.replace(/\s/g, "")).length;
  let length = 0;
  function visit(node: ImageNode, paragraphIndex = -1, paragraphSize = 0) {
    if (node.type === "text" && node.value && length <= 240) {
      const lines = node.value.split("\n");
      for (const [offset, line] of lines.entries()) {
        const entireLine = paragraphIndex >= 0 && (offset > 0 || paragraphIndex === 0) && (offset < lines.length - 1 || paragraphIndex === paragraphSize - 1);
        if (entireLine && line.trim().split(/\s+/).every(token => token.startsWith("#") && tagNames.has(tagKey(token.slice(1))))) continue;
        length += characterCount(line);
      }
    }
    if (node.tagName === "img" && typeof node.properties?.src === "string") {
      if (typeof node.properties.dataImageCaption === "string") length += characterCount(node.properties.dataImageCaption);
      try {
        const { target, wiki } = markdownTarget(node.properties.src);
        addImage(target, String(node.properties.alt || "笔记图片"), wiki || node.properties.dataWikiImage != null);
      } catch { /* Ignore malformed image URLs just as the reader does. */ }
    }
    node.children?.forEach((child, index, siblings) => visit(child, node.tagName === "p" ? index : -1, siblings.length));
  }
  visit(imageParser.runSync(imageParser.parse(body)));
  // Direct paths are already canonical. Resolve short names only when two
  // references could denote the same attachment. Keep unresolved references
  // in the classification even if a file is currently unavailable.
  const aliases = new Map<string, string>();
  const collisions = [...sameFilename.values()].filter(group => group.length > 1).flat();
  await Promise.all(collisions.map(async source => {
    const ref = deferred.get(source);
    if (!ref) return;
    try {
      const result = await request<ResolvedLink>("resolveLink", { ...ref, vaultBinding: note.vaultBinding });
      if (result.kind === "image") aliases.set(source, resolvedImageURL(result.path));
    } catch { /* The preview handles missing and ambiguous images. */ }
  }));
  const unique = new Map<string, PreviewImage>();
  for (const image of images.values()) {
    const source = aliases.get(image.source) ?? image.source;
    if (!unique.has(source)) unique.set(source, { ...image, source });
  }
  const imageLed = unique.size > 0 && length <= Math.min(80 * unique.size, 240);
  return { type: contentTypeOverride ?? (imageLed ? "image" : "text"), images: [...unique.values()] };
}
