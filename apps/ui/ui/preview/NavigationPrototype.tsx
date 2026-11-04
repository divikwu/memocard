// Isolated fixture using the production Web interface themes.
import "./environment";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App";
import { WebAppearanceProvider } from "../web/WebAppearance";
import { preloadWebEditor, renderWebApp } from "../web/WebAppView";
import { mock } from "./bridge";
import "../styles.css";

// Seed the existing isolated fixture; all edits and preferences disappear when this page reloads.
const samples = [
  ["把想法留下来，再慢慢整理", "不必等到想清楚才记录。先写下一句话，让灵感有地方停留。\n\n#随想", ["随想"]],
  ["让导航退后一步", "顶部导航把空间留给内容。侧栏则让标签和笔记之间的关系始终可见。\n\n#工作/设计", ["工作/设计"]],
  ["周末的手冲记录", "浅烘豆，92°C，粉水比 1:15。今天有一点清晰的柑橘香。\n\n#生活/咖啡", ["生活/咖啡"]],
  ["A little room for new ideas", "Keep useful notes close. Revisit unfinished thoughts. Make room for something unexpected.\n\n#阅读", ["阅读"]],
  ["下次出门想带上的东西", "- [ ] 相机\n- [ ] 一本薄薄的书\n- [ ] 留一点没有安排的时间\n\n#生活/旅行", ["生活/旅行"]],
  ["本周想完成的小事", "整理桌面、更新项目笔记，再去散一会儿步。\n\n#工作 #计划", ["工作", "计划"]],
] as const;
async function start() {
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ ...JSON.parse(localStorage.getItem("memocard-web-appearance-v1") || "{}"), interfaceTheme: new URLSearchParams(location.search).get("variant") === "sidebar" ? "classic" : "minimal" }));
  if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#/notes`);
  const notes = mock.snapshot().notes;
  for (const [index, sample] of samples.entries()) {
    await mock.request("saveNote", { ...notes[index], title: sample[0], body: sample[1], tags: [...sample[2]] });
    await mock.request("updateNoteProperty", { id: notes[index].id, name: "tags", type: "list", value: [...sample[2]] });
  }
  await mock.request("setTagPreferences", { pinned: ["工作/设计", "生活/咖啡"], icons: { "生活": "🌱", "阅读": "📚" } });
  const root = createRoot(document.getElementById("root")!);
  root.render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
}
void start();
