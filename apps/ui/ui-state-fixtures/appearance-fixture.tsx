import { workspaceActions, type WorkspaceNavigationProps } from "../ui/business/navigation-model";
import { appearanceCatalog } from "../ui/web/appearance/catalog";
import type { AppearanceCatalog } from "../ui/web/appearance/contracts";

function FixtureNavigation(p: WorkspaceNavigationProps) {
  const actions = workspaceActions(p);
  return <nav aria-label="测试布局"><button onClick={actions.home.run}>测试主页</button><button onClick={actions.settings.run}>测试设置</button></nav>;
}

// Never imported by the production catalog. Two independent extension seams.
export const appearanceFixture: AppearanceCatalog = {
  themes: {
    ...appearanceCatalog.themes,
    paper: { label: "测试纸感", layouts: { desktop: "topbar", mobile: "drawer" }, loadStyles: () => import("./appearance-fixture.css") },
    experimental: { label: "测试结构", layouts: { desktop: "experimental", mobile: "drawer" }, loadStyles: () => import("./appearance-fixture.css") },
  },
  layouts: {
    ...appearanceCatalog.layouts,
    experimental: { viewport: "desktop", load: async () => { await import("./appearance-layout-fixture.css"); return { TopNavigation: FixtureNavigation }; } },
  },
};
