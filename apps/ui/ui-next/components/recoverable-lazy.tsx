import { Component, lazy, type ComponentProps, type ComponentType } from "react";
import { Button } from "./button";

// Match React.lazy's component constraint while preserving each loader's props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function recoverableLazy<View extends ComponentType<any>>(load: () => Promise<{ default: View }>, title: string): ComponentType<ComponentProps<View>> {
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
      if (this.state.failed) return <section role="alert" className="space-y-3 p-4">
        <p>无法打开{title}，请检查连接后重试。</p>
        <Button variant="outline" onClick={this.retry} aria-label={`重试加载${title}`}>重试</Button>
      </section>;
      const Loaded = this.state.View as ComponentType<Props>;
      return <Loaded {...this.props as Props} />;
    }
  };
}
