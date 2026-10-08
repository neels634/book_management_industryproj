import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { transactionService } from '../services';
import { can } from '../utils/permissions';
import { FINE_STATUS_OPTIONS, TXN_STATUS_OPTIONS } from '../utils/constants';
import { formatDateTime, formatMoney } from '../utils/format';
import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import SearchInput from '../components/ui/SearchInput';
import { SelectField, TextField } from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import LoanActionDialogs from '../components/transactions/LoanActionDialogs';
import LoanActionsMenu from '../components/transactions/LoanActionsMenu';
import { transactionColumns } from '../components/transactions/transactionColumns';

function TransactionDetail({ txn, currency, onClose }) {
  const row = (label, value) => (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right text-stone-900">{value || '—'}</dd>
    </div>
  );
  return (
    <Modal open onClose={onClose} title={txn.transactionId} description={txn.book?.title} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <dl className="divide-y divide-stone-100">
        {row('Status', <StatusBadge status={txn.displayStatus} />)}
        {row('Member', `${txn.member?.name} (${txn.member?.memberId})`)}
        {row('Book', `${txn.book?.title} (${txn.book?.bookId})`)}
        {row('Issued', formatDateTime(txn.issueDate))}
        {row('Issued by', txn.issuedBy?.name)}
        {row('Due', formatDateTime(txn.dueDate))}
        {row('Renewals', txn.renewCount)}
        {row(txn.status === 'LOST' ? 'Reported lost' : 'Returned', formatDateTime(txn.returnDate || txn.lostReportedAt))}
        {row('Received by', txn.returnedTo?.name)}
        {row('Condition', txn.returnCondition && <StatusBadge status={txn.returnCondition} />)}
        {row('Overdue days', txn.currentOverdueDays)}
        {row('Fine rate', `${formatMoney(txn.finePerDay, currency)} / day`)}
        {row('Fine', txn.status === 'ISSUED' ? `${formatMoney(txn.accruedFine, currency)} (accruing)` : formatMoney(txn.fine, currency))}
        {txn.fineStatus !== 'NONE' && row('Fine status', <StatusBadge status={txn.fineStatus} />)}
        {txn.fineSettledAt && row('Settled', `${formatDateTime(txn.fineSettledAt)} by ${txn.fineSettledBy?.name || '—'}`)}
        {txn.remarks && row('Remarks', txn.remarks)}
      </dl>
    </Modal>
  );
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const isStaff = can(user, 'circulation:manage');
  useDocumentTitle(isStaff ? 'Transactions' : 'My loans');
  const [filters, setFilters] = useUrlFilters({ page: '1', limit: '10', sortBy: 'issueDate', order: 'desc' });
  const [action, setAction] = useState(null);
  const [detail, setDetail] = useState(null);

  const txns = useAsync(
    () =>
      transactionService.list({
        q: filters.q,
        status: filters.status,
        fineStatus: filters.fineStatus,
        from: filters.from,
        to: filters.to,
        sortBy: filters.sortBy,
        order: filters.order,
        page: filters.page,
        limit: filters.limit,
      }),
    [filters.q, filters.status, filters.fineStatus, filters.from, filters.to, filters.sortBy, filters.order, filters.page, filters.limit]
  );

  const columns = transactionColumns({
    currency: settings.currency,
    showMember: isStaff,
    linkEntities: isStaff,
    actions: isStaff ? (t) => <LoanActionsMenu txn={t} onAction={setAction} compact /> : undefined,
  });
  // Make the issue date sortable from the first column.
  columns[0].sortKey = 'issueDate';

  const dateError = filters.from && filters.to && filters.from > filters.to ? '"From" must be before "To"' : '';

  return (
    <>
      <PageHeader
        title={isStaff ? 'Transactions' : 'My loans'}
        description={isStaff ? 'The complete loan ledger. Nothing is ever deleted.' : 'Every book you have borrowed, with due dates and fines.'}
      />
      <Card>
        <div className="grid grid-cols-2 gap-3 border-b border-stone-100 p-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <SearchInput
            value={filters.q || ''}
            onChange={(q) => setFilters({ q })}
            placeholder={isStaff ? 'Transaction ID, book or member' : 'Book title or transaction ID'}
            className="col-span-2 lg:col-span-1"
          />
          <SelectField aria-label="Loan status" value={filters.status || ''} onChange={(e) => setFilters({ status: e.target.value })} placeholder="All statuses" options={TXN_STATUS_OPTIONS} />
          <SelectField aria-label="Fine status" value={filters.fineStatus || ''} onChange={(e) => setFilters({ fineStatus: e.target.value })} placeholder="Any fine" options={FINE_STATUS_OPTIONS} />
          <TextField aria-label="Issued from" type="date" value={filters.from || ''} max={filters.to} onChange={(e) => setFilters({ from: e.target.value })} error={dateError} />
          <TextField aria-label="Issued to" type="date" value={filters.to || ''} min={filters.from} onChange={(e) => setFilters({ to: e.target.value })} />
        </div>
        {txns.error ? (
          <ErrorState error={txns.error} onRetry={txns.reload} />
        ) : (
          <>
            <DataTable
              caption="Transactions"
              columns={columns}
              rows={txns.data?.data || []}
              loading={txns.loading}
              onRowClick={setDetail}
              sort={{ sortBy: filters.sortBy, order: filters.order }}
              onSortChange={setFilters}
              empty={<EmptyState icon={ReceiptText} title="No transactions found" description="Adjust the filters or date range." />}
            />
            <Pagination meta={txns.data?.meta} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
          </>
        )}
      </Card>
      {detail && <TransactionDetail txn={detail} currency={settings.currency} onClose={() => setDetail(null)} />}
      <LoanActionDialogs action={action} onClose={() => setAction(null)} onDone={txns.reload} />
    </>
  );
}
