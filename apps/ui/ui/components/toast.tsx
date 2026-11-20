import { Toast } from "@base-ui/react/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { Button } from "./button";
import { useThemeScopeProps } from "./theme-scope";
import "./toast.css";

export const useToastManager = Toast.useToastManager;

function ToastList() {
  const { toasts } = useToastManager();
  const scope = useThemeScopeProps();
  if (!toasts.length) return null;
  return <Toast.Portal {...scope}>
    <Toast.Viewport data-slot="toast-viewport" aria-label="通知" className="ui-toast-viewport">
      {toasts.map(item => <Toast.Root data-slot="toast" className="ui-toast" key={item.id} toast={item}>
        <Toast.Content data-slot="toast-content" className="ui-toast-content">
          <div className="ui-toast-message">
            <Toast.Title data-slot="toast-title" />
            {item.description && <Toast.Description data-slot="toast-description" />}
          </div>
          {item.actionProps && <Toast.Action data-slot="toast-action" render={<Button variant="outline" size="sm" />} />}
          <Toast.Close data-slot="toast-close" aria-label="关闭提醒" aria-hidden={false} render={<Button variant="ghost" size="icon-sm" />}>
            <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>)}
    </Toast.Viewport>
  </Toast.Portal>;
}

export function Toaster({ children, ...props }: Toast.Provider.Props) {
  return <Toast.Provider {...props}>{children}<ToastList /></Toast.Provider>;
}
