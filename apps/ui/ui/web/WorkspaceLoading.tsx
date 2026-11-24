import { Card, CardContent } from "../components/card";
import { Skeleton } from "../components/skeleton";
import "../business/QuickCaptureLayout.css";
import "./web-settings-layout.css";

export function HomeCaptureLoading() {
  return <div className="ui-quick-capture" data-slot="home-capture-skeleton" role="status" aria-label="正在准备快速记录">
    <span className="sr-only">正在准备快速记录…</span>
    <div className="ui-capture-group flex flex-col border border-transparent bg-surface" aria-hidden="true">
      <div className="ui-capture-editor-content"><Skeleton className="h-4 w-32" /></div>
      <div className="ui-capture-footer flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="ms-auto h-element-md w-18 rounded-full" />
      </div>
    </div>
  </div>;
}

export function SettingsLoading({ connected }: { connected: boolean }) {
  return <div className="web-settings">
    <header className="web-collection-heading"><h1 className="web-settings-title text-balance">设置</h1></header>
    <div className="web-settings-panel" data-slot="settings-skeleton">
      <span role="status" className="sr-only">正在读取设置…</span>
      <section aria-hidden="true"><h2 className="web-setting-vault-heading">笔记库</h2>
        <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content">
          <div className="web-setting-row web-setting-vault-picker">
            <Skeleton className="h-4 w-32" />
            <div className="web-setting-vault-actions"><Skeleton className="h-element-md w-16" /><Skeleton className="h-element-md w-16" /></div>
          </div>
          {connected && <div className="web-setting-row"><Skeleton className="my-2 h-5 w-28" /></div>}
        </CardContent></Card>
      </section>
      <section aria-hidden="true"><div className="web-setting-section-heading"><h2>外观</h2><Skeleton className="h-element-md w-20" /></div>
        <Card className="gap-0 py-0 shadow-none"><CardContent className="web-setting-card-content web-appearance-fields">
          {[0, 1, 2].map(row => <div key={row}><Skeleton className="h-4 w-16" /><Skeleton className="h-element-md w-full sm:w-48" /></div>)}
        </CardContent></Card>
      </section>
    </div>
  </div>;
}
