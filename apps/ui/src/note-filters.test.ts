import { describe, expect, it } from "vitest";
import { noteQuickFilters } from "./note-filters";

describe("note quick filters", () => {
  it.each([
    ["普通笔记", [], ["untagged"]],
    ["#工作 ![照片](assets/photo.png)", ["工作"], ["images"]],
    ["![[photo.PNG|照片]]", [], ["untagged", "images"]],
    ['<img src="https://example.com/photo.png">', [], ["untagged", "images"]],
    ["[参考](https://example.com) [[项目]]", ["工作"], ["links"]],
    ["https://example.com", [], ["untagged", "links"]],
    ["www.example.com", [], ["untagged", "links"]],
    ["正文[^1]\n\n[^1]: 只有脚注内容。", [], ["untagged"]],
    ["![照片][photo]\n\n[photo]: https://example.com/photo.png", [], ["untagged", "images"]],
    ["[资料][]\n\n[资料]: https://example.com", [], ["untagged", "links"]],
    ["[unused]: https://example.com\n<!-- ![隐藏](photo.png) -->", [], ["untagged"]],
    ["![照片](photo.png) [资料](https://example.com)", [], ["untagged", "images", "links"]],
    ["`![示例](photo.png)`\n```md\nhttps://example.com\n```\n    [[代码]]", [], ["untagged"]],
    ["```\n![未闭合代码](photo.png) https://example.com", [], ["untagged"]],
  ])("classifies %s", (body, tags, expected) => {
    expect(noteQuickFilters({ body, tags })).toEqual(expected);
  });
});
