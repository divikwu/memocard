// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { NoteMarkdown } from "./NoteMarkdown";

afterEach(cleanup);

it("renders the multiline story diagram with the real renderer and semantic theme, retaining its source", async () => {
  const source = "graph TD\nA[捕捉]-->B[整理]\nB-->C[回顾]";
  render(<NoteMarkdown body={`\`\`\`mermaid\n${source}\n\`\`\``} />);
  await screen.findByRole("button", { name: "放大 Mermaid 图表" });
  await waitFor(() => expect(screen.getByRole("img", { name: "Mermaid 图表" }).shadowRoot?.querySelector("svg")).toBeTruthy());
  const diagram = screen.getByRole("img", { name: "Mermaid 图表" }).shadowRoot!;
  expect(diagram.textContent).toContain("捕捉");
  expect(diagram.textContent).toContain("整理");
  expect(diagram.textContent).toContain("回顾");
  expect(diagram.querySelector("svg")?.getAttribute("style")).toContain("var(--color-text-primary)");
  expect(diagram.querySelector("svg")?.getAttribute("style")).toContain("--accent:var(--color-accent)");
  expect(diagram.textContent).not.toContain("@import");
  const code = document.querySelector("code.language-mermaid")!;
  expect(code.textContent).toBe(`${source}\n`);
  fireEvent.click(screen.getByRole("tab", { name: "仅图形" }));
  expect(code.closest<HTMLElement>(".note-mermaid-source")!.hidden).toBe(true);
  fireEvent.click(screen.getByRole("tab", { name: "仅源码" }));
  expect(code.closest<HTMLElement>(".note-mermaid-source")!.hidden).toBe(false);
  expect(document.querySelector("code.language-mermaid")).toBe(code);
});

it("keeps unsupported syntax intact and recovers with valid multiline input", async () => {
  const unsupported = "graph TD; A[捕捉]-->B[整理]; B-->C[回顾]";
  const view = render(<NoteMarkdown body={`\`\`\`mermaid\n${unsupported}\n\`\`\``} />);
  expect((await screen.findByRole("alert")).textContent).toContain("源码已保留");
  expect(document.querySelector("code.language-mermaid")?.textContent).toBe(`${unsupported}\n`);
  expect(screen.queryByRole("button", { name: "放大 Mermaid 图表" })).toBeNull();
  view.rerender(<NoteMarkdown body={"```mermaid\ngraph TD\nA[恢复]-->B[完成]\n```"} />);
  await screen.findByRole("button", { name: "放大 Mermaid 图表" });
  await waitFor(() => expect(screen.getByRole("img", { name: "Mermaid 图表" }).shadowRoot?.textContent).toContain("恢复"));
  expect(screen.queryByRole("alert")).toBeNull();
});
