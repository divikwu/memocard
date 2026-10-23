import type { ReactNode } from 'react';
import { richIcons } from './rich-icons';
import './PageNotice.css';

export function PageNotice({ title, children, actions, tone = 'error' }: {
  title: string; children: ReactNode; actions?: ReactNode; tone?: 'error' | 'info';
}) {
  return <div className="next-page-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
    <richIcons.Info aria-hidden="true" />
    <div><p className="next-page-notice-title">{title}</p><div>{children}</div>{actions && <div className="next-page-notice-actions">{actions}</div>}</div>
  </div>;
}
