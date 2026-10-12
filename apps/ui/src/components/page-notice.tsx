import type { ReactNode } from 'react';
import { CircleAlert, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function PageNotice({ title, children, actions, tone = 'error' }: {
  title: string; children: ReactNode; actions?: ReactNode; tone?: 'error' | 'info';
}) {
  const Icon = tone === 'error' ? CircleAlert : Info;
  return <Alert variant={tone === 'error' ? 'destructive' : 'default'} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon aria-hidden="true" />
    <AlertTitle className="text-balance">{title}</AlertTitle>
    <AlertDescription className="gap-3">
      <div className="min-w-0 break-words text-pretty">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2 text-foreground">{actions}</div>}
    </AlertDescription>
  </Alert>;
}
