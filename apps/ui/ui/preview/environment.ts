import { DEFAULT_WEB_APPEARANCE } from "../web/WebAppearance";

// Preferences are scoped to this frame and discarded on a scenario reset.
const params = new URLSearchParams(location.search);
const scenario = params.get("scenario");
const storage = new Map<string, string>([["memocard-web-appearance-v1", JSON.stringify({ ...DEFAULT_WEB_APPEARANCE, theme: params.get("theme") === "dark" ? "dark" : "light" })]]);
const memoryStorage: Storage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => {
    if (scenario === "theme-storage-error") throw new Error("模拟存储不可用");
    storage.set(key, String(value));
  },
  removeItem: key => { storage.delete(key); },
  clear: () => storage.clear(),
  key: index => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage });
Object.defineProperty(window, "sessionStorage", { configurable: true, value: memoryStorage });
if (scenario === "font-error") Object.defineProperty(document.fonts, "load", { configurable: true, value: () => Promise.reject(new Error("模拟字体加载失败")) });
window.addEventListener("beforeunload", event => event.stopImmediatePropagation(), true);
