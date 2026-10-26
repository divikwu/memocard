import { expect, it } from "vitest";
import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import config from "../../vite.preview-next.config";

const uiRoot = fileURLToPath(new URL("../../", import.meta.url));
const plugins = (config.plugins ?? []).flat() as Plugin[];
const isolated = plugins.find(plugin => plugin.name === "isolated-ui-next-preview")!;
const resolve = isolated.resolveId as (source: string, importer: string) => string | undefined;

it("replaces every supported bridge spelling before the real transport loads", () => {
  const importer = path.join(uiRoot, "src/App.tsx?t=example");
  for (const source of ["./bridge", "./bridge.ts", "@/bridge", "./client-mode"]) expect(resolve(source, importer)).toBe(path.join(uiRoot, "ui-next/preview/bridge.ts"));
  expect(resolve("./browser-runtime", importer)).toBe(path.join(uiRoot, "ui-next/preview/browser-runtime.ts"));
  expect(resolve("./unrelated", importer)).toBeUndefined();
});

it("blocks data API requests and adds a local content security policy", () => {
  let middleware: (req: { url: string }, res: { statusCode?: number; setHeader: (key: string, value: string) => void; end: (body: string) => void }, next: () => void) => void;
  const configure = isolated.configureServer as (server: unknown) => void;
  configure({ middlewares: { use: (handler: typeof middleware) => { middleware = handler; } } });
  let ended = "";
  const headers = new Map<string, string>();
  const response = { statusCode: 200, setHeader: (key: string, value: string) => { headers.set(key, value); }, end: (body: string) => { ended = body; } };
  let proceeded = false;
  middleware!({ url: "/api/notes?read=true" }, response, () => { proceeded = true; });
  expect(response.statusCode).toBe(403);
  expect(ended).toContain("no real data API");
  expect(proceeded).toBe(false);
  expect(headers.get("Content-Security-Policy")).toContain("connect-src 'self'");
});
