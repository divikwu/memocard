import type { CardPreviewProperties, NoteProperty } from '@memocard/contracts';
import type { BrowserDirectoryHandle, ParsedBrowserNote } from './browser-files';
import { readProperties } from './note-properties';
import { convertedProperty, groupProperties, inheritedProperties, parsePropertyDefinitions, propertyDefinitionPath } from './property-definitions';
import { renameSource } from './browser-rename';
import { isPropertyVisible, orderProperties } from './property-layout';
import { propertyLayoutOperation } from './browser-property-layout';

// The scan replaces parsed notes on a new hash; entries are released with that snapshot.
const parsedProperties = new WeakMap<ParsedBrowserNote, ReturnType<typeof readProperties>>();
export function cachedProperties(item:ParsedBrowserNote) {
  const cached = parsedProperties.get(item);
  if (cached) return cached;
  const data = readProperties(item.header ?? item.source ?? `---\n${item.frontmatter.toString()}---\n`,item.note.contentHash);
  parsedProperties.set(item,data);
  return data;
}

export async function cardPreviewProperties(root:BrowserDirectoryHandle, compatible:boolean, all:ParsedBrowserNote[], active:()=>Promise<unknown>) {
  const properties = (item:ParsedBrowserNote) => {
    try { return cachedProperties(item).properties; } catch { return []; }
  };
  const result = new Map<string, CardPreviewProperties>();
  const selected = all.filter(item => properties(item).length);
  if (!selected.length) return result;

  const metadata = await Promise.all([
    renameSource(root,propertyDefinitionPath,compatible).then(value => parsePropertyDefinitions(value ?? '')),
    propertyLayoutOperation('getPropertyLayout',{},root,active),
  ]);
  const [config, layout] = metadata;
  const names = new Set(selected.flatMap(item => properties(item).map(property => property.name)));
  const inferred = new Set([...names].filter(name => !config[name]));
  const groups = groupProperties(inferred.size ? all.filter(item => !item.note.deletedAt).flatMap(item => properties(item).filter(property => inferred.has(property.name))) : []);
  const stored = Object.fromEntries(Object.entries(config).filter(([name, definition]) => names.has(name) && (definition.type === 'text' || definition.type === 'image')));
  const definitions = new Map(inheritedProperties([],stored,groups).map(definition => [definition.name,definition]));
  const key = (property:NoteProperty) => `property:${property.name}`;
  for (const item of selected) {
    const rows = properties(item).slice().sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const preview:CardPreviewProperties = {images:[]};
    for (const raw of orderProperties(rows,layout.order,key)) {
      const definition = definitions.get(raw.name);
      if (raw.type === 'unsupported' || !definition || (definition.type !== 'text' && definition.type !== 'image')) continue;
      const {type,value} = raw.type === definition.type ? raw : convertedProperty(raw,{type:definition.type});
      if (typeof value !== 'string' || !value.trim() || !isPropertyVisible(layout,key(raw),value)) continue;
      if (type === 'image') preview.images.push(value);
      else preview.text ??= value.trim();
    }
    if (preview.images.length || preview.text) result.set(item.note.id,preview);
  }
  return result;
}
