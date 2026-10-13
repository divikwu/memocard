// SVG is generated locally, then isolated from the note's HTML and network resources.
export function mermaidSVG(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('图表输出无效。');
  const tags = new Set(['svg', 'g', 'defs', 'marker', 'path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'text', 'tspan', 'title', 'desc', 'style', 'clipPath']);
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (!tags.has(element.localName)) { element.remove(); continue; }
    for (const attr of [...element.attributes]) {
      if (/^on/i.test(attr.name) || /(?:href|src)$/i.test(attr.name) || /(?:https?:|data:|javascript:|@import|expression\s*\()/i.test(attr.value) || /url\s*\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value)) element.removeAttribute(attr.name);
    }
    if (element.localName === 'style') element.textContent = (element.textContent ?? '').replace(/@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/gi, '');
  }
  return root.outerHTML;
}
