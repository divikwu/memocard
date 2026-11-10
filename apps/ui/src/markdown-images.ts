import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { unified } from "unified";
import { wikiMarkdown } from "./wiki-markdown";
import { imageSource } from "./vault-links";
import { markdownSchema, markdownTarget } from "./markdown-schema";

type ImageNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: ImageNode[] };
const imageParser = unified().use(remarkParse).use(remarkGfm).use(wikiMarkdown).use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeSanitize, markdownSchema);
export function markdownImageCandidates(body: string, notePath: string) {
  if (!body.includes("![") && !/<img\b/i.test(body)) return [];
  const images: { source: string; alt: string }[] = [];
  function visit(node: ImageNode) {
    if (node.type === "element" && node.tagName === "img" && typeof node.properties?.src === "string") {
      try {
        const { target, wiki } = markdownTarget(node.properties.src);
        const source = imageSource(target, notePath, wiki || node.properties.dataWikiImage != null);
        if (source) images.push({ source, alt: typeof node.properties.alt === "string" ? node.properties.alt : "" });
      } catch { /* Ignore invalid link encoding, as in the reader. */ }
    }
    node.children?.forEach(visit);
  }
  visit(imageParser.runSync(imageParser.parse(body)));
  return images;
}
