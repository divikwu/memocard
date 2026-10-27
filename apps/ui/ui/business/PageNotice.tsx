import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon';
import './PageNotice.css';

export function PageNotice({ title, children, actions, tone = 'error' }: {
  title: string; children: ReactNode; actions?: ReactNode; tone?: 'error' | 'info';
}) {
  return <div className="ui-page-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
    <div className="ui-page-notice-content"><HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} aria-hidden="true" /><div><p className="ui-page-notice-title">{title}</p><div>{children}</div></div></div>
    {actions && <div className="ui-page-notice-actions">{actions}</div>}
  </div>;
}
