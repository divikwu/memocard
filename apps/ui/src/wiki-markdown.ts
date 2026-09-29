type Node = { type: string; value?: string; url?: string; alt?: string; children?: Node[] };
/** Render wikilinks without rewriting the saved source. Code and existing links are left alone. */
export function wikiMarkdown() {
  return (tree: Node) => {
    const visit = (parent: Node) => {
      if (!parent.children || ["link", "code", "inlineCode"].includes(parent.type)) return;
      parent.children = parent.children.flatMap(node => {
        if (node.type !== "text") { visit(node); return [node]; }
        const text = node.value ?? "", nodes: Node[] = [];
        let offset = 0;
        for (const match of text.matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
          nodes.push({ type: "text", value: text.slice(offset, match.index) });
          const [target, label] = match[2].split("|");
          if (match[1] && /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(target)) nodes.push({ type: "image", url: `memocard-wiki:${encodeURIComponent(target)}`, alt: label ?? target });
          else if (!match[1]) nodes.push({ type: "link", url: `memocard-wiki:${encodeURIComponent(target)}`, children: [{ type: "text", value: label ?? target }] });
          else nodes.push({ type: "text", value: match[0] });
          offset = match.index! + match[0].length;
        }
        nodes.push({ type: "text", value: text.slice(offset) });
        return nodes;
      });
    };
    visit(tree);
  };
}
