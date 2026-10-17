import { useEffect, useRef, useState } from "react";
import { request } from "./bridge";
import { createId } from "./uuid";
import { isIOSNative } from "./ios-mode";
export { isIOSNative } from "./ios-mode";
export type NativeAction = { id: string; title: string; icon?: string; path?: string; emoji?: string; badge?: number; subtitle?: string; imagePath?: string; color?: string; disabled?: boolean; destructive?: boolean; selected?: boolean };
export type NativeField = { id: string; title: string; value: string; kind?: "text" | "multiline"; disabled?: boolean };
export type NativeSection = { id: string; title?: string; message?: string; actions?: NativeAction[]; fields?: NativeField[] };
export type NativeSurface = {
  kind: "chrome" | "list" | "form" | "alert" | "search" | "capture";
  title: string; presented?: boolean; busy?: boolean; loading?: boolean; message?: string; error?: string;
  resetKey?: string; rowRadius?: number; theme?: "light" | "dark" | "system";
  summary?: string;
  palette?: Record<string, number[]>;
  sections?: NativeSection[]; primary?: NativeAction; leading?: NativeAction; pin?: NativeAction;
  menu?: NativeAction[]; titleMenu?: NativeAction[]; bottom?: NativeAction[];
};
type NativeEvent = { surface: string; instance: string; action: string; value?: string };

// SwiftUI renders these controls; React retains the existing operation and draft lifecycle.
export function useIOSSurface(id: string, surface: NativeSurface | (() => NativeSurface), onAction: (action: string, value?: string) => void | Promise<void>) {
  const [instance] = useState(() => isIOSNative ? createId() : "");
  const callback = useRef(onAction);
  callback.current = onAction;
  const model = isIOSNative ? typeof surface === "function" ? surface() : surface : null;
  const visible = model?.kind === "chrome" || model?.presented;
  const encoded = model ? JSON.stringify({ ...(visible ? model : {kind:model.kind,title:model.title,presented:false,summary:model.summary}), id, instance }) : "";
  useEffect(() => {
    if (!isIOSNative) return;
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<NativeEvent>).detail;
      if (detail?.surface === id && detail.instance === instance) void callback.current(detail.action, detail.value);
    };
    window.addEventListener("memocard:native-action", receive);
    return () => {
      window.removeEventListener("memocard:native-action", receive);
      void request("updateNativeSurface", { id, instance, remove: true });
    };
  }, [id, instance]);
  useEffect(() => {
    if (isIOSNative) void request("updateNativeSurface", JSON.parse(encoded));
  }, [encoded]);
}
