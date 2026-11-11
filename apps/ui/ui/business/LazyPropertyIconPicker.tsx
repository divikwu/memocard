import { Suspense, type ComponentProps } from "react";
import { recoverableLazy } from "../components/recoverable-lazy";

const Picker = recoverableLazy(() => import("./PropertyIconPicker").then(module => ({ default: module.PropertyIconPicker })), "图标选择器");

export function LazyPropertyIconPicker(props: ComponentProps<typeof Picker>) {
  return <Suspense fallback={<p id={props.id} role="status" className="text-secondary">正在加载图标…</p>}>
    <Picker {...props} />
  </Suspense>;
}
