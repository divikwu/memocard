import { expect, it } from "vitest";
import { analyzeNoteContent } from "./markdown-images";

const first = "![说明](../assets/1.png)";
const analyze = (body: string, images: string[] = []) => analyzeNoteContent({
  body, relativePath: "notes/a.md", tags: ["设计"], cardPreview: { images },
});

it.each([[1, 80, "image"], [1, 81, "text"], [3, 240, "image"], [4, 241, "text"], [10, 500, "text"]] as const)(
  "classifies %i images with %i characters as %s", async (count, length, type) => {
    const body = Array.from({ length: count }, (_, i) => `![配图](../assets/${i}.png)`).join("\n\n");
    expect((await analyze(body + "\n\n" + "图".repeat(length))).type).toBe(type);
  });

it("counts displayed writing including captions and code, ignores tag lines and deduplicates ordered covers", async () => {
  const figure = '<figure><img src="../assets/2.png"><figcaption>图注</figcaption></figure>';
  const result = await analyze([first, first, figure, "#设计", "字".repeat(158)].join("\n\n"), ["../assets/2.png"]);
  expect(result.type).toBe("image");
  expect(result.images.map(image => image.source.split("/").at(-1))).toEqual(["2.png", "1.png"]);
  expect((await analyze(first + "\n\n" + figure + "\n\n" + "字".repeat(159))).type).toBe("text");
  expect((await analyze('<img src="../assets/a.png" data-image-caption="' + "字".repeat(81) + '">')).type).toBe("text");
  expect((await analyze(first + "\n\n**" + "字".repeat(80) + "** #设计")).type).toBe("text");
  expect((await analyze("```\n" + first + "\n```")).images).toEqual([]);
  expect((await analyze(first + "\n\n```\n" + "字".repeat(81) + "\n```")).type).toBe("text");
});
