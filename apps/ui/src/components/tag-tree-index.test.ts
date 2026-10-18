import { expect, it } from "vitest";
import { indexTags } from "./tag-tree-index";

it("preserves input order, first duplicate counts and exact slash boundaries without creating parents", () => {
  const tags = [
    { name: "zebra", count: 1 }, { name: "zebra/third", count: 2 },
    { name: "missing/child/deeper", count: 3 }, { name: "zebra/first", count: 4 },
    { name: "alpha", count: 5 }, { name: "zebra/first", count: 99 },
    { name: "/leading", count: 6 }, { name: "zebra/", count: 7 },
    { name: "", count: 8 }, { name: "zebra//nested", count: 9 }, { name: "zebra//", count: 10 },
  ];
  const index = indexTags(tags);
  expect(index.roots.map(tag => tag.name)).toEqual(["zebra", "alpha", ""]);
  expect(index.byName.get("zebra/first")?.count).toBe(4);
  expect(index.byName.has("missing")).toBe(false);
  expect(index.byName.has("missing/child")).toBe(false);
  expect(index.children.get("missing/child")).toEqual([tags[2]]);
  expect(index.children.get("zebra")?.map(tag => tag.name)).toEqual(["zebra/third", "zebra/first", "zebra/first", "zebra/"]);
  expect(index.children.get("")).toEqual([tags[6]]);
  expect(index.children.get("zebra/")).toEqual([tags[9], tags[10]]);
});

it("agrees with immediate-child and root traversal for mixed paths in source order", () => {
  const names = ["a", "b", "", "a/", "/b", "a/b", "a/b/c", "a//b", "a/b/", "absent/b", "a/b", "A/b", "工作", "工作/设计"];
  const tags = names.map((name, count) => ({ name, count }));
  const index = indexTags(tags);
  expect(index.roots).toEqual(tags.filter(tag => !tag.name.includes("/")));
  for (const path of [...names, "absent", "a//", "not-present"]) {
    expect(index.children.get(path) || []).toEqual(tags.filter(tag => tag.name.startsWith(path + "/") && !tag.name.slice(path.length + 1).includes("/")));
    expect(index.byName.get(path)).toBe(tags.find(tag => tag.name === path));
  }
});
