import type { ReactNode } from 'react';

export function PropertyOptionsFailure({ retry }: { retry:ReactNode }) {
  return <div role="alert" className="note-property-load-failure"><span>加载失败</span>{retry}</div>;
}
