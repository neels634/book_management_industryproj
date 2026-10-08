import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftRight, Mail, MapPin, Pencil, Phone, UserX } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { useSettings } from '../../hooks/useSettings';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { memberService } from '../../services';
import { TXN_STATUS_OPTIONS } from '../../utils/constants';
import { formatDate, formatMoney, initials, titleCase } from '../../utils/format';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatCard from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/Badge';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback';
import { SelectField } from '../../components/ui/FormField';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import MemberFormModal from '../../components/members/MemberFormModal';
import LoanActionDialogs from '../../components/transactions/LoanActionDialogs';
import LoanActionsMenu from '../../components/transactions/LoanActionsMenu';
import { transactionColumns } from '../../components/transactions/transactionColumns';

export default function MemberDetailsPage() {
  const { id } = useParams();
  const toast = useToast();
  const { settings } = useSettings();
  const [modal, setModal] = useState(null);
  const [loanAction, setLoanAction] = useState(null);
  const [historyQuery, setHistoryQuery] = useState({ page: 1, status: '' });

  const member = useAsync(() => memberService.get(id).then((r) => r.data), [id]);
  const history = useAsync(
    () => memberService.history(id, { page: historyQuery.page, limit: 10, status: historyQuery.status }),
    [id, historyQuery]
  );
  useDocumentTitle(member.data?.name);

  if (member.loading && !member.data) return <PageLoader />;
  if (member.error) return <ErrorState error={member.error} onRetry={member.reload} title="Could not load this member" />;
  const m = member.data;
  const { stats } = m;
  const currency = settings.currency;

  const refresh = () => {
    member.reload();
    history.reload();
  };

  const deactivate = async () => {
    try {
      const res = await memberService.deactivate(m._id);
      toast.success(res.message);
      refresh();
    } catch (err) {
      toast.error(err.message, { title: 'Cannot close membership' });
      throw err;
    }
  };

  const canBorrow =
    m.membershipStatus === 'ACTIVE' && m.currentBorrowedCount < m.borrowingLimit && (!m.membershipExpiry || new Date(m.membershipExpiry) > new Date());
  const loanColumns = transactionColumns({
    currency,
    showMember: false,
    actions: (t) => <LoanActionsMenu txn={t} onAction={setLoanAction} compact />,
  });

  return (
    <>
      <PageHeader
        back={{ to: '/members', label: 'Members' }}
        eyebrow={`${m.memberId} · ${titleCase(m.membershipType)}`}
        title={m.name}
        actions={
          <>
            {canBorrow && (
              <Link to={`/circulation?tab=issue&member=${m._id}`}>
                <Button icon={ArrowLeftRight}>Issue book</Button>
              </Link>
            )}
            <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
              Edit
            </Button>
            {m.membershipStatus !== 'INACTIVE' && (
              <Button variant="danger-ghost" icon={UserX} onClick={() => setModal('deactivate')}>
                Close membership
              </Button>
            )}
          </>
        }
      />

      {m.membershipStatus !== 'ACTIVE' && (
        <Alert tone="warning" className="mb-6" title={`Membership ${m.membershipStatus.toLowerCase()}`}>
          This member cannot borrow books until the membership is reactivated.
        </Alert>
      )}
      {stats.overdueLoans > 0 && (
        <Alert tone="error" className="mb-6" title={`${stats.overdueLoans} overdue loan(s)`}>
          {formatMoney(stats.accruingFines, currency)} in fines is accruing. New loans are blocked until overdue books are returned.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 font-display text-lg font-semibold text-brass-200">
                {initials(m.name)}
              </span>
              <div>
                <StatusBadge status={m.membershipStatus} />
                <p className="mt-1 text-xs text-stone-500">Member since {formatDate(m.membershipDate)}</p>
                {m.membershipExpiry && <p className="text-xs text-stone-500">Expires {formatDate(m.membershipExpiry)}</p>}
              </div>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-stone-700">
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-stone-400" aria-hidden />
                {m.phone}
              </li>
              {m.email && (
                <li className="flex items-center gap-2.5 break-all">
                  <Mail className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                  {m.email}
                </li>
              )}
              {m.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                  {m.address}
                </li>
              )}
            </ul>
            <p className="mt-4 border-t border-stone-100 pt-4 text-xs text-stone-500">
              Online account: {m.user ? <span className="font-medium text-stone-700">@{m.user.username}</span> : 'none'}
            </p>
            {m.notes && <p className="mt-2 text-xs italic text-stone-500">{m.notes}</p>}
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-3">
          <StatCard label="On loan" value={`${m.currentBorrowedCount} / ${m.borrowingLimit}`} hint="Current / limit" tone="blue" />
          <StatCard label="Overdue" value={stats.overdueLoans} tone="red" highlight={stats.overdueLoans > 0} />
          <StatCard label="Total loans" value={stats.totalLoans} hint={`${stats.lostBooks} lost`} />
          <StatCard label="Fines due" value={formatMoney(stats.pendingFines, currency)} tone="amber" />
          <StatCard label="Accruing" value={formatMoney(stats.accruingFines, currency)} hint="Overdue, not yet returned" tone="amber" />
          <StatCard label="Fines paid" value={formatMoney(stats.paidFines, currency)} tone="green" />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Current loans" description={`${m.activeLoans.length} book(s) out`} />
        <DataTable
          caption="Current loans"
          columns={loanColumns}
          rows={m.activeLoans.map((t) => ({ ...t, member: { _id: m._id, name: m.name, memberId: m.memberId } }))}
          empty={<p className="px-5 py-6 text-sm text-stone-400">No books on loan.</p>}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Borrowing history"
          actions={
            <SelectField
              aria-label="Filter history"
              value={historyQuery.status}
              onChange={(e) => setHistoryQuery({ page: 1, status: e.target.value })}
              placeholder="All loans"
              options={TXN_STATUS_OPTIONS}
            />
          }
        />
        <DataTable caption="Borrowing history" columns={loanColumns} rows={history.data?.data || []} loading={history.loading} />
        <Pagination meta={history.data?.meta} onPageChange={(page) => setHistoryQuery((q) => ({ ...q, page }))} />
      </Card>

      {modal === 'edit' && (
        <MemberFormModal
          open
          member={m}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={modal === 'deactivate'}
        onClose={() => setModal(null)}
        onConfirm={deactivate}
        title="Close this membership?"
        confirmLabel="Close membership"
        message={
          m.currentBorrowedCount > 0
            ? `${m.name} still has ${m.currentBorrowedCount} book(s). They must be returned or marked lost first.`
            : `${m.name} will no longer be able to borrow, and their online account will be disabled. Borrowing history is kept.`
        }
      />
      <LoanActionDialogs action={loanAction} onClose={() => setLoanAction(null)} onDone={refresh} />
    </>
  );
}
