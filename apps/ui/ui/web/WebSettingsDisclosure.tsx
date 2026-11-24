import { useRef, type ReactNode, type Ref } from "react";
import { ChevronDownIcon } from "../icons";

export function WebSettingsDisclosure({ label, advanced, children, ref }: {
  label: string;
  advanced?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDetailsElement>;
}) {
  const body = useRef<HTMLDivElement>(null);
  return <details ref={ref} className={advanced ? "web-file-status web-appearance-advanced" : "web-file-status"}
    onToggle={event => {
      const details = event.currentTarget;
      if (!details.open && body.current?.contains(document.activeElement)) details.querySelector("summary")?.focus();
      if (body.current) body.current.inert = !details.open;
    }}>
    <summary>{label}<ChevronDownIcon aria-hidden="true" /></summary>
    <div ref={body} className="web-file-status-body" inert>{children}</div>
  </details>;
}
