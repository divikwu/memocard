import { useRef, type ReactNode } from "react";
import { ChevronDownIcon } from "../icons";

export function WebSettingsDisclosure({ label, children }: {
  label: string;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  return <details className="web-file-status"
    onToggle={event => {
      const details = event.currentTarget;
      if (!details.open && body.current?.contains(document.activeElement)) details.querySelector("summary")?.focus();
      if (body.current) body.current.inert = !details.open;
    }}>
    <summary>{label}<ChevronDownIcon aria-hidden="true" /></summary>
    <div ref={body} className="web-file-status-body" inert>{children}</div>
  </details>;
}
