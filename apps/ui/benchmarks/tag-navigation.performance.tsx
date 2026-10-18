import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { TagNavigation } from "../src/components/tag-navigation";

// Run the real navigation and recursive branches, replacing only presentation and
// browser storage. This isolates tree work from DOM/layout and is not an FPS test.
vi.mock("../src/TagColorStyles", () => ({ default: () => null }));
vi.mock("../src/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("../src/hooks/use-tag-preferences", () => ({ useTagPreferences: () => ({ preferences: { pinned: [], icons: {} }, error: "", togglePinned() {}, saveAppearance() {} }) }));
vi.mock("../src/components/sidebar-tree-item", () => ({ SidebarTreeItem: ({ children, label, accessories }: { children?: ReactNode; label: string; accessories?: ReactNode }) => <div>{label}{accessories}{children}</div> }));
vi.mock("../src/components/ui/collapsible", () => ({ Collapsible: ({ children }: { children?: ReactNode }) => children, CollapsibleContent: ({ children }: { children?: ReactNode }) => children, CollapsibleTrigger: ({ children }: { children?: ReactNode }) => children }));
vi.mock("../src/components/ui/sidebar", () => {
  const Content = ({ children }: { children?: ReactNode }) => children;
  return { SidebarGroup: Content, SidebarGroupLabel: Content, SidebarMenu: Content, SidebarMenuBadge: Content, SidebarMenuAction: Content, SidebarMenuSub: Content };
});
vi.mock("../src/components/ui/dropdown-menu", () => ({ DropdownMenu: () => null, DropdownMenuContent: () => null, DropdownMenuItem: () => null, DropdownMenuTrigger: () => null }));

type Tag = { name: string; count: number };
type Shape = "flat" | "branches" | "missing-parents";
function fixture(size: number, shape: Shape): Tag[] {
  return Array.from({ length: size }, (_, index) => {
    const group = Math.floor(index / 10);
    const offset = index % 10;
    const name = shape === "flat" ? `tag-${index}` : shape === "missing-parents" && offset % 2 ? `absent-${group}/tag-${offset}` : offset === 0 ? `group-${group}` : offset < 5 ? `group-${group}/tag-${offset}` : `group-${group}/tag-1/sub-${offset}`;
    return { name, count: index % 37 };
  });
}

function instrument(tags: Tag[]) {
  const calls = { filter: 0, find: 0, some: 0, iterations: 0, visits: 0 };
  for (const method of ["filter", "find", "some"] as const) {
    const original = tags[method].bind(tags) as (callback: (tag: Tag, index: number, array: Tag[]) => boolean) => unknown;
    Object.defineProperty(tags, method, { value: (callback: (tag: Tag, index: number, array: Tag[]) => boolean) => {
      calls[method]++;
      return original((tag, index, array) => { calls.visits++; return callback(tag, index, array); });
    } });
  }
  const iterator = tags[Symbol.iterator].bind(tags);
  Object.defineProperty(tags, Symbol.iterator, { value: function* () {
    calls.iterations++;
    for (const tag of { [Symbol.iterator]: iterator }) { calls.visits++; yield tag; }
  } });
  return calls;
}

const render = (tags: Tag[]) => renderToStaticMarkup(<TagNavigation tags={tags} selected={null} onSelect={() => {}} />);

it("records real tag traversal work and warmed render timings without timing assertions", async () => {
  const results = [];
  const sizes = (process.env.MEMOCARD_TAG_BENCH_SIZES || "1000,5000,10000").split(",").map(Number);
  const sampleCount = 11;
  for (const shape of ["flat", "branches", "missing-parents"] as const) {
    for (const size of sizes) {
      const tags = fixture(size, shape);
      const observed = fixture(size, shape);
      const calls = instrument(observed);
      const html = render(observed);
      expect(html).toContain(shape === "flat" ? "tag-0" : "group-0");
      for (let warmup = 0; warmup < 2; warmup++) render(tags);
      const timings = [];
      for (let sample = 0; sample < sampleCount; sample++) {
        const start = performance.now();
        render(tags);
        timings.push(performance.now() - start);
      }
      timings.sort((a, b) => a - b);
      results.push({ shape, size, samples: sampleCount, medianMs: Number(timings[Math.floor(sampleCount / 2)].toFixed(3)), p95Ms: Number(timings[Math.ceil(sampleCount * .95) - 1].toFixed(3)), timingsMs: timings.map(time => Number(time.toFixed(3))), ...calls });
    }
  }
  const report = { label: process.env.MEMOCARD_TAG_BENCH_LABEL || "working-tree", scope: "production TagNavigation/TagBranch, SSR with presentation primitives mocked, cold mount per sample; excludes DOM/layout", node: process.version, platform: process.platform, arch: process.arch, warmup: 2, results };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.MEMOCARD_TAG_BENCH_OUTPUT) {
    await mkdir(dirname(process.env.MEMOCARD_TAG_BENCH_OUTPUT), { recursive: true });
    await writeFile(process.env.MEMOCARD_TAG_BENCH_OUTPUT, JSON.stringify(report, null, 2) + "\n");
  }
});
