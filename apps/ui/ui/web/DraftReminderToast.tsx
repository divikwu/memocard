import { useEffect, useRef } from "react";
import { Toaster, useToastManager } from "../components/toast";

type DraftReminderProps = {
  active: boolean;
  count: number;
  onOpen: () => void;
  onDismiss: () => void;
};

function DraftReminderNotice({ active, count, onOpen, onDismiss }: DraftReminderProps) {
  const { add, close } = useToastManager();
  const toastId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!active) {
      if (toastId.current) close(toastId.current);
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || toastId.current !== undefined) return;
      const id = add({
        title: `有 ${count} 条未完成的草稿`,
        actionProps: { children: "查看草稿", onClick: () => { onOpen(); close(id); } },
        onClose: () => { toastId.current = null; onDismiss(); },
      });
      toastId.current = id;
    });
    return () => { cancelled = true; };
  }, [active, count, add, close, onOpen, onDismiss]);
  return null;
}

export default function DraftReminderToast(props: DraftReminderProps) {
  return <Toaster limit={1} timeout={9000}><DraftReminderNotice {...props} /></Toaster>;
}
