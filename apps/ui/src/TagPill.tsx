import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function TagPill({name, className, children, ...props}:ComponentProps<typeof Badge> & {name:string}) {
  return <Badge variant="secondary" {...props} data-tag={encodeURIComponent(name)} className={cn('note-tag-pill',className)}>{children ?? name}</Badge>;
}
