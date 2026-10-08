import { Link } from 'react-router-dom';
import { StatusBadge } from '../ui/Badge';
import { dueLabel, formatDate, formatMoney } from '../../utils/format';

/** Column definitions shared by every transaction table. */
export function transactionColumns({ currency, showMember = true, showBook = true, linkEntities = true, actions } = {}) {
  const cols = [
    {
      key: 'transactionId',
      header: 'Transaction',
      mobile: showBook ? 'hidden' : 'title',
      render: (t) => (
        <div>
          <p className="font-mono text-xs text-stone-700">{t.transactionId}</p>
          <p className="text-xs text-stone-400">{formatDate(t.issueDate)}</p>
        </div>
      ),
    },
  ];
  if (showBook) {
    cols.push({
      key: 'book',
      header: 'Book',
      mobile: 'title',
      render: (t) => (
        <div className="min-w-0 max-w-[16rem]">
          {linkEntities ? (
            <Link to={`/books/${t.book?._id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-stone-900 hover:text-ink-700 hover:underline">
              {t.book?.title}
            </Link>
          ) : (
            <p className="font-medium text-stone-900">{t.book?.title}</p>
          )}
          <p className="text-xs text-stone-400">{t.book?.bookId}</p>
        </div>
      ),
    });
  }
  if (showMember) {
    cols.push({
      key: 'member',
      header: 'Member',
      render: (t) =>
        linkEntities ? (
          <Link to={`/members/${t.member?._id}`} onClick={(e) => e.stopPropagation()} className="hover:text-ink-700 hover:underline">
            <span className="text-stone-800">{t.member?.name}</span>
            <span className="block text-xs text-stone-400">{t.member?.memberId}</span>
          </Link>
        ) : (
          <span>{t.member?.name}</span>
        ),
    });
  }
  cols.push(
    {
      key: 'dueDate',
      header: 'Due / returned',
      sortKey: 'dueDate',
      render: (t) =>
        t.status === 'ISSUED' ? (
          <div>
            <p className="text-stone-800">{formatDate(t.dueDate)}</p>
            <p className={`text-xs ${t.isOverdue ? 'font-medium text-rose-600' : 'text-stone-400'}`}>{dueLabel(t.dueDate)}</p>
          </div>
        ) : (
          <div>
            <p className="text-stone-800">{formatDate(t.returnDate || t.lostReportedAt)}</p>
            <p className="text-xs text-stone-400">
              {t.overdueDays > 0 ? `${t.overdueDays} day(s) late` : t.status === 'LOST' ? 'Reported lost' : 'On time'}
            </p>
          </div>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.displayStatus} />,
    },
    {
      key: 'fine',
      header: 'Fine',
      sortKey: 'fine',
      className: 'text-right md:text-right',
      render: (t) => {
        const amount = t.status === 'ISSUED' ? t.accruedFine : t.fine;
        if (!amount) return <span className="text-stone-300">—</span>;
        return (
          <div className="md:text-right">
            <p className={`font-medium tabular ${t.fineStatus === 'PENDING' || t.status === 'ISSUED' ? 'text-amber-700' : 'text-stone-700'}`}>
              {formatMoney(amount, currency)}
            </p>
            <p className="text-xs text-stone-400">{t.status === 'ISSUED' ? 'accruing' : <StatusLabel status={t.fineStatus} />}</p>
          </div>
        );
      },
    }
  );
  if (actions) {
    cols.push({ key: 'actions', header: '', mobile: 'full', className: 'w-px whitespace-nowrap', render: actions });
  }
  return cols;
}

function StatusLabel({ status }) {
  return { PENDING: 'unpaid', PAID: 'paid', WAIVED: 'waived', NONE: '' }[status] || '';
}
