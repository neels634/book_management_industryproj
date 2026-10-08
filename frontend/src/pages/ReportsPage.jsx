import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertOctagon, Coins, Download, Flame, Library, Printer, Tags, UserSearch } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { categoryService, memberService, reportService } from '../services';
import { downloadCsv } from '../utils/csv';
import { TXN_STATUS_OPTIONS } from '../utils/constants';
import { formatDate, formatMoney, toDateInput } from '../utils/format';
import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import DataTable from '../components/ui/DataTable';
import EntityPicker from '../components/ui/EntityPicker';
import StatCard from '../components/ui/StatCard';
import { SelectField, TextField } from '../components/ui/FormField';
import { AvailabilityBadge, StatusBadge } from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import InventoryBar from '../components/ui/InventoryBar';

const TABS = [
  { value: 'overdue', label: 'Overdue', icon: AlertOctagon },
  { value: 'popular', label: 'Popular books', icon: Flame },
  { value: 'inventory', label: 'Inventory', icon: Library },
  { value: 'categories', label: 'Categories', icon: Tags },
  { value: 'fines', label: 'Fines', icon: Coins },
  { value: 'member', label: 'Member history', icon: UserSearch },
];

function Toolbar({ children, onExport, exportDisabled }) {
  return (
    <div className="flex flex-col gap-3 border-b border-stone-100 p-4 lg:flex-row lg:items-end">
      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      <div className="flex gap-2 print:hidden">
        <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="secondary" icon={Download} onClick={onExport} disabled={exportDisabled}>
          CSV
        </Button>
      </div>
    </div>
  );
}

function DateRange({ value, onChange }) {
  const invalid = value.from && value.to && value.from > value.to;
  return (
    <>
      <TextField label="From" type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} error={invalid ? 'Must be before "To"' : undefined} />
      <TextField label="To" type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
    </>
  );
}

function CategorySelect({ value, onChange, categories }) {
  return (
    <SelectField
      label="Category"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="All categories"
      options={categories.map((c) => ({ value: c._id, label: c.name }))}
    />
  );
}

const validRange = (r) => !(r.from && r.to && r.from > r.to);
const stamp = () => toDateInput();

function OverdueReport({ categories, currency }) {
  const [category, setCategory] = useState('');
  const report = useAsync(() => reportService.overdue({ category }).then((r) => r.data), [category]);
  const items = report.data?.items || [];
  return (
    <>
      <Toolbar
        exportDisabled={!items.length}
        onExport={() =>
          downloadCsv(`overdue-${stamp()}.csv`, items, [
            { header: 'Transaction', value: (t) => t.transactionId },
            { header: 'Book', value: (t) => t.book?.title },
            { header: 'Member', value: (t) => t.member?.name },
            { header: 'Member ID', value: (t) => t.member?.memberId },
            { header: 'Phone', value: (t) => t.member?.phone },
            { header: 'Due date', value: (t) => formatDate(t.dueDate) },
            { header: 'Days overdue', value: (t) => t.currentOverdueDays },
            { header: 'Accrued fine', value: (t) => t.accruedFine },
          ])
        }
      >
        <CategorySelect value={category} onChange={setCategory} categories={categories} />
      </Toolbar>
      {report.data && (
        <div className="grid grid-cols-2 gap-3 p-4 sm:max-w-md">
          <StatCard label="Overdue loans" value={report.data.summary.count} tone="red" />
          <StatCard label="Accrued fines" value={formatMoney(report.data.summary.totalAccruedFine, currency)} tone="amber" />
        </div>
      )}
      {report.error ? (
        <ErrorState error={report.error} onRetry={report.reload} />
      ) : (
        <DataTable
          caption="Overdue loans"
          loading={report.loading}
          rows={items}
          empty={<EmptyState icon={AlertOctagon} title="Nothing overdue" description="Every book on loan is within its due date." />}
          columns={[
            { key: 'book', header: 'Book', mobile: 'title', render: (t) => <span className="font-medium text-stone-900">{t.book?.title}</span> },
            { key: 'member', header: 'Member', render: (t) => (<div><p>{t.member?.name}</p><p className="text-xs text-stone-400">{t.member?.memberId} · {t.member?.phone}</p></div>) },
            { key: 'due', header: 'Due', render: (t) => formatDate(t.dueDate) },
            { key: 'days', header: 'Days late', render: (t) => <span className="font-semibold text-rose-600 tabular">{t.currentOverdueDays}</span> },
            { key: 'fine', header: 'Accrued', render: (t) => <span className="tabular">{formatMoney(t.accruedFine, currency)}</span> },
          ]}
        />
      )}
    </>
  );
}

function PopularReport({ categories }) {
  const [range, setRange] = useState({ from: '', to: '' });
  const [category, setCategory] = useState('');
  const report = useAsync(
    () => (validRange(range) ? reportService.popularBooks({ ...range, category, limit: 25 }).then((r) => r.data) : Promise.resolve([])),
    [range.from, range.to, category]
  );
  const items = report.data || [];
  const max = Math.max(1, ...items.map((i) => i.issueCount));
  return (
    <>
      <Toolbar
        exportDisabled={!items.length}
        onExport={() =>
          downloadCsv(`popular-books-${stamp()}.csv`, items, [
            { header: 'Rank', value: (_r) => items.indexOf(_r) + 1 },
            { header: 'Book ID', value: (b) => b.bookId },
            { header: 'Title', value: (b) => b.title },
            { header: 'Category', value: (b) => b.category },
            { header: 'Loans', value: (b) => b.issueCount },
            { header: 'Copies', value: (b) => b.totalCopies },
          ])
        }
      >
        <DateRange value={range} onChange={setRange} />
        <CategorySelect value={category} onChange={setCategory} categories={categories} />
      </Toolbar>
      <DataTable
        caption="Popular books"
        loading={report.loading}
        rows={items}
        rowKey={(r) => r.book}
        empty={<EmptyState icon={Flame} title="No loans in this period" />}
        columns={[
          { key: 'rank', header: '#', render: (b) => <span className="font-display font-semibold text-stone-400">{items.indexOf(b) + 1}</span>, mobile: 'hidden' },
          { key: 'title', header: 'Book', mobile: 'title', render: (b) => (<div><p className="font-medium text-stone-900">{b.title}</p><p className="text-xs text-stone-400">{b.bookId} · {b.authors?.join(', ')}</p></div>) },
          { key: 'category', header: 'Category' },
          {
            key: 'issueCount',
            header: 'Loans',
            render: (b) => (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-[#0f7f5c]" style={{ width: `${(b.issueCount / max) * 100}%` }} />
                </div>
                <span className="font-semibold tabular">{b.issueCount}</span>
              </div>
            ),
          },
          { key: 'copies', header: 'Copies', render: (b) => `${b.availableCopies} / ${b.totalCopies} free` },
        ]}
      />
    </>
  );
}

function InventoryReport({ categories }) {
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const report = useAsync(() => reportService.books({ status, category }).then((r) => r.data), [status, category]);
  const items = report.data?.items || [];
  const s = report.data?.summary;
  return (
    <>
      <Toolbar
        exportDisabled={!items.length}
        onExport={() =>
          downloadCsv(`inventory-${status}-${stamp()}.csv`, items, [
            { header: 'Book ID', value: (b) => b.bookId },
            { header: 'Title', value: (b) => b.title },
            { header: 'ISBN', value: (b) => b.isbn },
            { header: 'Authors', value: (b) => b.authors.join('; ') },
            { header: 'Category', value: (b) => b.category?.name },
            { header: 'Total', value: (b) => b.totalCopies },
            { header: 'Available', value: (b) => b.availableCopies },
            { header: 'Issued', value: (b) => b.issuedCopies },
            { header: 'Damaged', value: (b) => b.damagedCopies },
            { header: 'Lost', value: (b) => b.lostCopies },
            { header: 'Status', value: (b) => b.status },
          ])
        }
      >
        <SelectField
          label="Show"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: 'all', label: 'All books in circulation' },
            { value: 'available', label: 'Available books' },
            { value: 'unavailable', label: 'All copies out' },
            { value: 'issued', label: 'Issued books' },
            { value: 'damaged', label: 'With damaged copies' },
            { value: 'lost', label: 'With lost copies' },
            { value: 'inactive', label: 'Withdrawn books' },
          ]}
        />
        <CategorySelect value={category} onChange={setCategory} categories={categories} />
      </Toolbar>
      {s && (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Titles" value={s.titles} />
          <StatCard label="Copies" value={s.totalCopies} />
          <StatCard label="Available" value={s.availableCopies} tone="green" />
          <StatCard label="Issued" value={s.issuedCopies} tone="blue" />
          <StatCard label="Damaged" value={s.damagedCopies} tone="amber" />
          <StatCard label="Lost" value={s.lostCopies} tone="red" />
        </div>
      )}
      <DataTable
        caption="Inventory"
        loading={report.loading}
        rows={items}
        columns={[
          { key: 'title', header: 'Book', mobile: 'title', render: (b) => (<div><p className="font-medium text-stone-900">{b.title}</p><p className="text-xs text-stone-400">{b.bookId} · {b.isbn}</p></div>) },
          { key: 'category', header: 'Category', render: (b) => b.category?.name },
          { key: 'copies', header: 'Copies', render: (b) => <InventoryBar book={b} compact /> },
          { key: 'detail', header: 'Issued / damaged / lost', render: (b) => <span className="tabular text-stone-600">{b.issuedCopies} / {b.damagedCopies} / {b.lostCopies}</span> },
          { key: 'status', header: 'Availability', render: (b) => <AvailabilityBadge book={b} /> },
        ]}
      />
    </>
  );
}

function CategoryReport({ currency }) {
  const [range, setRange] = useState({ from: '', to: '' });
  const report = useAsync(() => (validRange(range) ? reportService.categories(range).then((r) => r.data) : Promise.resolve([])), [range.from, range.to]);
  const items = report.data || [];
  return (
    <>
      <Toolbar
        exportDisabled={!items.length}
        onExport={() =>
          downloadCsv(`category-stats-${stamp()}.csv`, items, [
            { header: 'Category', value: (c) => c.name },
            { header: 'Titles', value: (c) => c.titles },
            { header: 'Copies', value: (c) => c.totalCopies },
            { header: 'Available', value: (c) => c.availableCopies },
            { header: 'Issued', value: (c) => c.issuedCopies },
            { header: 'Loans in period', value: (c) => c.issues },
            { header: 'Fines in period', value: (c) => c.fines },
          ])
        }
      >
        <DateRange value={range} onChange={setRange} />
      </Toolbar>
      <DataTable
        caption="Category statistics"
        loading={report.loading}
        rows={items}
        rowKey={(c) => c.category}
        columns={[
          { key: 'name', header: 'Category', mobile: 'title', render: (c) => (<span className="font-medium text-stone-900">{c.name} {c.status === 'INACTIVE' && <StatusBadge status="INACTIVE" />}</span>) },
          { key: 'titles', header: 'Titles' },
          { key: 'totalCopies', header: 'Copies' },
          { key: 'availableCopies', header: 'Available' },
          { key: 'issuedCopies', header: 'On loan' },
          { key: 'issues', header: 'Loans (period)' },
          { key: 'fines', header: 'Fines (period)', render: (c) => formatMoney(c.fines, currency) },
        ]}
      />
    </>
  );
}

function FinesReport({ categories, currency }) {
  const [range, setRange] = useState({ from: '', to: '' });
  const [fineStatus, setFineStatus] = useState('');
  const [category, setCategory] = useState('');
  const report = useAsync(
    () => (validRange(range) ? reportService.fines({ ...range, fineStatus, category }).then((r) => r.data) : Promise.resolve(null)),
    [range.from, range.to, fineStatus, category]
  );
  const items = report.data?.items || [];
  const s = report.data?.summary;
  return (
    <>
      <Toolbar
        exportDisabled={!items.length}
        onExport={() =>
          downloadCsv(`fines-${stamp()}.csv`, items, [
            { header: 'Transaction', value: (t) => t.transactionId },
            { header: 'Member', value: (t) => t.member?.name },
            { header: 'Member ID', value: (t) => t.member?.memberId },
            { header: 'Book', value: (t) => t.book?.title },
            { header: 'Reason', value: (t) => (t.status === 'LOST' ? 'Lost' : t.returnCondition === 'DAMAGED' ? 'Late/damaged' : 'Late return') },
            { header: 'Assessed', value: (t) => formatDate(t.fineAssessedAt) },
            { header: 'Amount', value: (t) => t.fine },
            { header: 'Status', value: (t) => t.fineStatus },
            { header: 'Settled', value: (t) => formatDate(t.fineSettledAt) },
          ])
        }
      >
        <DateRange value={range} onChange={setRange} />
        <SelectField
          label="Status"
          value={fineStatus}
          onChange={(e) => setFineStatus(e.target.value)}
          placeholder="All fines"
          options={[
            { value: 'PENDING', label: 'Unpaid' },
            { value: 'PAID', label: 'Collected' },
            { value: 'WAIVED', label: 'Waived' },
          ]}
        />
        <CategorySelect value={category} onChange={setCategory} categories={categories} />
      </Toolbar>
      {s && (
        <div className="grid grid-cols-3 gap-3 p-4 lg:max-w-2xl">
          <StatCard label="Collected" value={formatMoney(s.collected, currency)} tone="green" />
          <StatCard label="Unpaid" value={formatMoney(s.pending, currency)} tone="amber" />
          <StatCard label="Waived" value={formatMoney(s.waived, currency)} />
        </div>
      )}
      <DataTable
        caption="Fines"
        loading={report.loading}
        rows={items}
        empty={<EmptyState icon={Coins} title="No fines in this period" />}
        columns={[
          { key: 'member', header: 'Member', mobile: 'title', render: (t) => (<div><p className="font-medium text-stone-900">{t.member?.name}</p><p className="text-xs text-stone-400">{t.member?.memberId}</p></div>) },
          { key: 'book', header: 'Book', render: (t) => (<div><p>{t.book?.title}</p><p className="text-xs text-stone-400">{t.transactionId}</p></div>) },
          { key: 'reason', header: 'Reason', render: (t) => (t.status === 'LOST' ? 'Lost book' : `${t.overdueDays} day(s) late${t.returnCondition === 'DAMAGED' ? ' + damage' : ''}`) },
          { key: 'assessed', header: 'Assessed', render: (t) => formatDate(t.fineAssessedAt) },
          { key: 'amount', header: 'Amount', render: (t) => <span className="font-semibold tabular">{formatMoney(t.fine, currency)}</span> },
          { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.fineStatus} /> },
        ]}
      />
    </>
  );
}

function MemberHistoryReport({ currency }) {
  const [member, setMember] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [status, setStatus] = useState('');
  const report = useAsync(
    () =>
      member && validRange(range)
        ? reportService.memberHistory({ member: member._id, ...range, status }).then((r) => r.data)
        : Promise.resolve(null),
    [member?._id, range.from, range.to, status]
  );
  const items = report.data?.items || [];
  return (
    <>
      <Toolbar
        exportDisabled={!items.length}
        onExport={() =>
          downloadCsv(`history-${member.memberId}-${stamp()}.csv`, items, [
            { header: 'Transaction', value: (t) => t.transactionId },
            { header: 'Book', value: (t) => t.book?.title },
            { header: 'Issued', value: (t) => formatDate(t.issueDate) },
            { header: 'Due', value: (t) => formatDate(t.dueDate) },
            { header: 'Returned', value: (t) => formatDate(t.returnDate) },
            { header: 'Status', value: (t) => t.displayStatus },
            { header: 'Fine', value: (t) => t.fine },
            { header: 'Fine status', value: (t) => t.fineStatus },
          ])
        }
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <EntityPicker
            label="Member"
            placeholder="Search member"
            search={(q) => memberService.list({ q, limit: 8 }).then((r) => r.data)}
            value={member}
            onChange={setMember}
            renderOption={(m) => (
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-stone-500">{m.memberId}</p>
              </div>
            )}
          />
        </div>
        <DateRange value={range} onChange={setRange} />
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All loans" options={TXN_STATUS_OPTIONS} />
      </Toolbar>
      {!member ? (
        <EmptyState icon={UserSearch} title="Choose a member" description="Pick a member to see their complete borrowing history." />
      ) : (
        <>
          {report.data && (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              <StatCard label="Total loans" value={report.data.stats.totalLoans} />
              <StatCard label="On loan" value={report.data.stats.activeLoans} tone="blue" />
              <StatCard label="Overdue" value={report.data.stats.overdueLoans} tone="red" />
              <StatCard label="Unpaid fines" value={formatMoney(report.data.stats.pendingFines, currency)} tone="amber" />
            </div>
          )}
          <DataTable
            caption="Member history"
            loading={report.loading}
            rows={items}
            columns={[
              { key: 'book', header: 'Book', mobile: 'title', render: (t) => <span className="font-medium text-stone-900">{t.book?.title}</span> },
              { key: 'issued', header: 'Issued', render: (t) => formatDate(t.issueDate) },
              { key: 'due', header: 'Due', render: (t) => formatDate(t.dueDate) },
              { key: 'returned', header: 'Returned', render: (t) => formatDate(t.returnDate) },
              { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.displayStatus} /> },
              { key: 'fine', header: 'Fine', render: (t) => (t.fine ? `${formatMoney(t.fine, currency)} · ${t.fineStatus.toLowerCase()}` : '—') },
            ]}
          />
        </>
      )}
    </>
  );
}

export default function ReportsPage() {
  useDocumentTitle('Reports');
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'overdue';
  const categories = useAsync(() => categoryService.list().then((r) => r.data), []);
  const props = { categories: categories.data || [], currency: settings.currency };

  return (
    <>
      <PageHeader title="Reports" description="Filter, print or export any report to CSV." />
      <Tabs className="mb-4 print:hidden" tabs={TABS} value={tab} onChange={(value) => setParams({ tab: value }, { replace: true })} />
      <Card>
        {tab === 'overdue' && <OverdueReport {...props} />}
        {tab === 'popular' && <PopularReport {...props} />}
        {tab === 'inventory' && <InventoryReport {...props} />}
        {tab === 'categories' && <CategoryReport {...props} />}
        {tab === 'fines' && <FinesReport {...props} />}
        {tab === 'member' && <MemberHistoryReport {...props} />}
      </Card>
    </>
  );
}
