import { defaultSchema } from "rehype-sanitize";
import type rehypeSanitize from "rehype-sanitize";
import { calloutColors } from "./import-layout";

export const markdownSchema = { ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), 'memocard-wiki'], src: [...(defaultSchema.protocols?.src ?? []), 'memocard-wiki'] },
  tagNames: [...(defaultSchema.tagNames ?? []).filter(tag => !['details', 'summary', 'dl', 'dt', 'dd'].includes(tag)), 'mark', 'abbr', 'kbd', 'sub', 'sup', 'u', 'caption', 'figure', 'figcaption', 'aside'],
  attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']], abbr: ['title'], img: [...(defaultSchema.attributes?.img ?? []), ['dataWikiImage', ''], 'dataImageCaption'], figure: [['dataImageColumns', /^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?){1,2}$/]], aside: [['dataCallout', ...calloutColors], ['dataCalloutTextColor', ...calloutColors], 'dataCalloutIcon'] } } satisfies NonNullable<Parameters<typeof rehypeSanitize>[0]>;

export function markdownTarget(url: string) {
  const wiki = url.startsWith("memocard-wiki:");
  return { wiki, target: wiki ? decodeURIComponent(url.slice("memocard-wiki:".length)) : url };
}
