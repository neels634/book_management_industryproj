import { Link } from 'react-router-dom';
import { AlertOctagon, BookOpen, Coins, Library, ReceiptText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { transactionService } from '../services';
import { dueLabel, formatDate, formatMoney } from '../utils/format';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert, EmptyState, ErrorState, SkeletonBlock } from '../components/ui/Feedback';
import { StatusBadge } from '../components/ui/Badge';
import Button from '../components/ui/Button';

/** A member's own view: current loans, due dates and fines. */
export default function MemberDashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        transactionService.list({ status: 'ISSUED', limit: 50, sortBy: 'dueDate', order: 'asc' }),
        transactionService.list({ fineStatus: 'PENDING', limit: 50 }),
      ]).then(([loans, fines]) => ({ loans: loans.data, fines: fines.data })),
    []
  );

  const member = user.member;
  if (!member) {
    return (
      <EmptyState
        icon={Library}
        title="Your account is not linked to a library membership"
        description="Ask the librarian to link your login to your member record."
      />
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const overdue = data?.loans.filter((l) => l.isOverdue) || [];
  const finesDue = (data?.fines || []).reduce((s, t) => s + t.fine, 0);
  const accruing = overdue.reduce((s, t) => s + t.accruedFine, 0);

  return (
    <>
      <PageHeader
        eyebrow={`${member.memberId} · ${member.membershipType?.toLowerCase()} member`}
        title={`Hello, ${member.name.split(' ')[0]}`}
        description={`You can borrow up to ${member.borrowingLimit} books at a time for ${settings.loanPeriodDays} days each.`}
        actions={
          <Link to="/books">
            <Button icon={BookOpen}>Browse catalogue</Button>
          </Link>
        }
      />

      {member.membershipStatus !== 'ACTIVE' && (
        <Alert tone="warning" className="mb-4" title={`Membership ${member.membershipStatus.toLowerCase()}`}>
          You cannot borrow new books at the moment. Please contact the library desk.
        </Alert>
      )}
      {overdue.length > 0 && (
        <Alert tone="error" className="mb-4" title={`${overdue.length} book(s) overdue`}>
          Fines of {formatMoney(settings.finePerDay, settings.currency)} per day apply. Please return them as soon as possible.
        </Alert>
      )}

      {loading && !data ? (
        <SkeletonBlock className="h-28" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="On loan" value={`${data.loans.length} / ${member.borrowingLimit}`} icon={BookOpen} tone="blue" />
          <StatCard label="Overdue" value={overdue.length} icon={AlertOctagon} tone="red" highlight={overdue.length > 0} />
          <StatCard label="Fines due" value={formatMoney(finesDue, settings.currency)} icon={Coins} tone="brass" />
          <StatCard label="Accruing" value={formatMoney(accruing, settings.currency)} hint="On overdue loans" icon={ReceiptText} tone="amber" />
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="Books you have" actions={<Link to="/transactions" className="text-sm font-medium text-ink-700 hover:underline">Full history</Link>} />
        {data && data.loans.length === 0 ? (
          <EmptyState icon={BookOpen} title="No books on loan" description="Find something to read in the catalogue." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {(data?.loans || []).map((loan) => (
              <li key={loan._id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">{loan.book?.title}</p>
                  <p className="text-xs text-stone-500">
                    {loan.book?.authors?.join(', ')} · issued {formatDate(loan.issueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:text-right">
                  <div>
                    <p className={`text-sm font-medium ${loan.isOverdue ? 'text-rose-600' : 'text-stone-800'}`}>{dueLabel(loan.dueDate)}</p>
                    <p className="text-xs text-stone-500">Due {formatDate(loan.dueDate)}</p>
                  </div>
                  <StatusBadge status={loan.displayStatus} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data?.fines.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Unpaid fines" description="Pay at the library desk." />
          <ul className="divide-y divide-stone-100">
            {data.fines.map((t) => (
              <li key={t._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-900">{t.book?.title}</p>
                  <p className="text-xs text-stone-500">
                    {t.status === 'LOST' ? 'Lost book' : `${t.overdueDays} day(s) late`} · {t.transactionId}
                  </p>
                </div>
                <span className="font-semibold text-amber-700 tabular">{formatMoney(t.fine, settings.currency)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
