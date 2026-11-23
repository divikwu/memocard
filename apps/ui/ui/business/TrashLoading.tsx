import { Skeleton } from "../components/skeleton";
import "./trash.css";

export function TrashRowsLoading({ canPermanentlyDelete }: { canPermanentlyDelete: boolean }) {
  return <div className="ui-trash-list" aria-hidden="true">
    {[0, 1, 2].map(index => <div key={index} className="ui-trash-card">
      <div className="ui-trash-summary ui-trash-open"><Skeleton className="h-5 w-40 max-w-full" /><Skeleton className="h-4 w-48 max-w-full" /></div>
      <Skeleton className="ui-trash-date h-4 w-32" />
      <div className="ui-trash-actions"><Skeleton className="h-8 w-14" />{canPermanentlyDelete && <Skeleton className="h-8 w-24" />}</div>
    </div>)}
  </div>;
}
