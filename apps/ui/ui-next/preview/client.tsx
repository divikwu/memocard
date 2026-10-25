import "./environment";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App";
import { WebAppearanceProvider } from "../web/WebAppearance";
import { preloadWebEditor } from "../web/WebAppView";
import { ScenarioView } from "./ScenarioView";
import { getScenario, noteId } from "./scenarios";
import { mock } from "./bridge";
import "../styles.css";

const scenario = getScenario(new URLSearchParams(location.search).get("scenario"));
const route = ["theme-storage-error", "font-error"].includes(scenario.id) ? "#/settings" : scenario.detail ? `#/notes/${noteId}` : "#/notes";
history.replaceState(null, "", `${location.pathname}${location.search}${route}`);
document.addEventListener("click", event => {
  const target = event.target instanceof Element ? event.target.closest("a,button") : null;
  if (target instanceof HTMLAnchorElement) event.preventDefault();
  if (target?.textContent?.includes("重试") || target?.textContent?.includes("重新读取") || target?.textContent === "重新加载" || target?.textContent?.startsWith("重新选择")) mock.retry();
}, true);
if (["属性", "确认"].includes(scenario.group)) {
  const observer = new MutationObserver(() => {
    const toggle = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "属性");
    if (!toggle || toggle.disabled) return;
    observer.disconnect();
    if (toggle.getAttribute("aria-expanded") !== "true") toggle.click();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
const root = createRoot(document.getElementById("root")!);
root.render(<WebAppearanceProvider><App renderView={state => <ScenarioView state={state} scenario={scenario} />} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
