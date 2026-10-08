import { Banknote, BookX, RotateCcw, Undo2 } from 'lucide-react';
import Button from '../ui/Button';

/** Row-level buttons for a loan: Return / Renew / Lost while open, Settle when a fine is due. */
export default function LoanActionsMenu({ txn, onAction, compact = false }) {
  const open = txn.status === 'ISSUED';
  const finePending = txn.fineStatus === 'PENDING';
  if (!open && !finePending) return null;

  const stop = (type) => (e) => {
    e.stopPropagation();
    onAction({ type, txn });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {open && (
        <>
          <Button size="sm" onClick={stop('return')} icon={Undo2}>
            Return
          </Button>
          <Button size="sm" variant="secondary" onClick={stop('renew')} icon={RotateCcw} disabled={txn.isOverdue} aria-label="Renew" title={txn.isOverdue ? 'Overdue loans cannot be renewed' : undefined}>
            {compact ? '' : 'Renew'}
          </Button>
          <Button size="sm" variant="danger-ghost" onClick={stop('lost')} icon={BookX} aria-label="Mark lost" title="Mark lost">
            {compact ? '' : 'Lost'}
          </Button>
        </>
      )}
      {finePending && (
        <Button size="sm" variant="accent" onClick={stop('fine')} icon={Banknote}>
          Settle fine
        </Button>
      )}
    </div>
  );
}
