type Tag = { name: string; count: number };

export function indexTags(tags: Tag[]) {
  const byName = new Map<string, Tag>();
  const children = new Map<string, Tag[]>();
  const roots: Tag[] = [];
  for (const tag of tags) {
    if (!byName.has(tag.name)) byName.set(tag.name, tag);
    const separator = tag.name.lastIndexOf("/");
    if (separator < 0) roots.push(tag);
    else {
      const parent = tag.name.slice(0, separator);
      const siblings = children.get(parent);
      if (siblings) siblings.push(tag);
      else children.set(parent, [tag]);
    }
  }
  return { byName, children, roots };
}
