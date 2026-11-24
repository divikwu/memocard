import { useEffect, useState } from "react";
import { Button } from "../components/button";
import { Toaster, useToastManager, type ToastData } from "../components/toast";

function EditorLoadErrorNotice({ retry }: { retry: () => void }) {
  const { add } = useToastManager<ToastData>();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    add({
      id: "editor-load-error",
      title: "笔记编辑器加载失败",
      description: "如果重试后仍无法打开，请刷新当前页面。",
      timeout: 0,
      actionProps: { children: "重试加载", onClick: retry },
      data: { secondaryActionProps: { children: "刷新页面", onClick: () => window.location.reload() } },
      onClose: () => setDismissed(true),
    });
  }, [add, retry]);
  return dismissed ? <Button variant="outline" size="sm" onClick={retry}>重试加载编辑器</Button> : null;
}

export default function EditorLoadErrorToast({ retry }: { retry: () => void }) {
  return <Toaster limit={1}><EditorLoadErrorNotice retry={retry} /></Toaster>;
}
