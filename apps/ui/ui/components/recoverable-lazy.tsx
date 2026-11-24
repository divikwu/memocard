import { Component, lazy, useEffect, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { localWebEntryMissing } from "../web/local-web-entry-missing";
import { Button } from "./button";

function LoadRecovery({ title, retry }: { title: string; retry: () => void }) {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  useEffect(() => {
    void localWebEntryMissing().then(setNeedsRefresh);
  }, []);
  return <div role="alert">
    {needsRefresh
      ? <Button variant="outline" onClick={() => window.location.reload()}>刷新页面</Button>
      : <Button variant="outline" onClick={retry}>重试加载{title}</Button>}
  </div>;
}

// Match React.lazy's component constraint while preserving each loader's props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function recoverableLazy<View extends ComponentType<any>>(load: () => Promise<{ default: View }>, title: string, fallback?: (props: Readonly<ComponentProps<View>>, retry: () => void) => ReactNode): ComponentType<ComponentProps<View>> {
  type Props = ComponentProps<View>;
  let Current = lazy(load);
  return class RecoverableFeature extends Component<Props, { failed: boolean; View: typeof Current }> {
    state = { failed: false, View: Current };

    static getDerivedStateFromError() { return { failed: true }; }

    retry = () => {
      // A new lazy object retries the loader instead of reusing its rejected Promise.
      Current = lazy(load);
      this.setState({ failed: false, View: Current });
    };

    render() {
      if (this.state.failed && fallback) return fallback(this.props, this.retry);
      if (this.state.failed) return <LoadRecovery title={title} retry={this.retry} />;
      const Loaded = this.state.View as ComponentType<Props>;
      return <Loaded {...this.props as Props} />;
    }
  };
}
