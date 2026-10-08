import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { memberService } from '../../services';
import { MEMBERSHIP_TYPES } from '../../utils/constants';
import { formatDate, initials, titleCase } from '../../utils/format';
import PageHeader from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import { SelectField } from '../../components/ui/FormField';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState, ErrorState } from '../../components/ui/Feedback';
import MemberFormModal from '../../components/members/MemberFormModal';

function LoanMeter({ member }) {
  const pct = Math.min(100, (member.currentBorrowedCount / member.borrowingLimit) * 100);
  const full = member.currentBorrowedCount >= member.borrowingLimit;
  return (
    <div className="w-24">
      <p className="text-xs text-stone-600 tabular">
        <span className="font-semibold text-stone-900">{member.currentBorrowedCount}</span> / {member.borrowingLimit}
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full rounded-full ${full ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MembersPage() {
  useDocumentTitle('Members');
  const navigate = useNavigate();
  const [filters, setFilters] = useUrlFilters({ page: '1', limit: '10', sortBy: 'name', order: 'asc' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (filters.new) {
      setCreating(true);
      setFilters({ new: '' });
    }
  }, [filters.new, setFilters]);

  const members = useAsync(
    () =>
      memberService.list({
        q: filters.q,
        status: filters.status,
        membershipType: filters.type,
        hasLoans: filters.hasLoans,
        sortBy: filters.sortBy,
        order: filters.order,
        page: filters.page,
        limit: filters.limit,
      }),
    [filters.q, filters.status, filters.type, filters.hasLoans, filters.sortBy, filters.order, filters.page, filters.limit]
  );

  const columns = [
    {
      key: 'name',
      header: 'Member',
      sortKey: 'name',
      mobile: 'title',
      render: (m) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-800">
            {initials(m.name)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-stone-900">{m.name}</p>
            <p className="text-xs text-stone-500">{m.memberId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (m) => (
        <div className="min-w-0 text-xs">
          <p className="text-stone-700">{m.phone}</p>
          <p className="truncate text-stone-400">{m.email || '—'}</p>
        </div>
      ),
    },
    { key: 'membershipType', header: 'Type', render: (m) => titleCase(m.membershipType) },
    { key: 'membershipDate', header: 'Since', sortKey: 'membershipDate', render: (m) => formatDate(m.membershipDate) },
    { key: 'currentBorrowedCount', header: 'Loans', sortKey: 'currentBorrowedCount', render: (m) => <LoanMeter member={m} /> },
    { key: 'membershipStatus', header: 'Status', render: (m) => <StatusBadge status={m.membershipStatus} /> },
  ];

  return (
    <>
      <PageHeader
        title="Members"
        description="Registered borrowers, their limits and current loans."
        actions={<Button icon={UserPlus} onClick={() => setCreating(true)}>Register member</Button>}
      />
      <Card>
        <div className="grid grid-cols-2 gap-3 border-b border-stone-100 p-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <SearchInput value={filters.q || ''} onChange={(q) => setFilters({ q })} placeholder="Name, member ID, phone or e-mail" className="col-span-2 lg:col-span-1" />
          <SelectField
            aria-label="Status"
            value={filters.status || ''}
            onChange={(e) => setFilters({ status: e.target.value })}
            placeholder="All statuses"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
          <SelectField
            aria-label="Membership type"
            value={filters.type || ''}
            onChange={(e) => setFilters({ type: e.target.value })}
            placeholder="All types"
            options={MEMBERSHIP_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
          />
          <SelectField
            aria-label="Loans"
            value={filters.hasLoans || ''}
            onChange={(e) => setFilters({ hasLoans: e.target.value })}
            placeholder="Any loans"
            options={[
              { value: 'true', label: 'Has books out' },
              { value: 'false', label: 'No books out' },
            ]}
          />
        </div>
        {members.error ? (
          <ErrorState error={members.error} onRetry={members.reload} />
        ) : (
          <>
            <DataTable
              caption="Members"
              columns={columns}
              rows={members.data?.data || []}
              loading={members.loading}
              onRowClick={(m) => navigate(`/members/${m._id}`)}
              sort={{ sortBy: filters.sortBy, order: filters.order }}
              onSortChange={setFilters}
              empty={<EmptyState icon={Users} title="No members found" description="Try another search, or register a new member." />}
            />
            <Pagination meta={members.data?.meta} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
          </>
        )}
      </Card>

      {creating && (
        <MemberFormModal
          open
          onClose={() => setCreating(false)}
          onSaved={(m) => {
            setCreating(false);
            navigate(`/members/${m._id}`);
          }}
        />
      )}
    </>
  );
}
