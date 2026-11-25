// Run before the application module so a saved dark scheme applies to the first paint.
(() => {
  let preference;
  try {
    const { localStorage } = globalThis;
    const raw = localStorage.getItem("memocard-web-appearance-v1") ?? localStorage.getItem("memocard-appearance-v1");
    preference = raw && JSON.parse(raw)?.theme;
  } catch { /* Storage can be unavailable or contain an older, unreadable value. */ }
  const dark = preference === "dark" || (preference === "system" && globalThis.matchMedia("(prefers-color-scheme: dark)").matches);
  const mode = dark ? "dark" : "light";
  const { document } = globalThis;
  document.documentElement.dataset.uiTheme = mode;
  document.querySelector('meta[name="color-scheme"]').content = mode;
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0a0a0a" : "#ffffff";
})();
