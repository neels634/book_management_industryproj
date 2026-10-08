import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowLeftRight,
  BookCopy,
  BookOpenCheck,
  BookPlus,
  Coins,
  Library,
  Undo2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { reportService } from '../services';
import { ROLES } from '../utils/constants';
import { dueLabel, formatDate, formatMoney, formatNumber } from '../utils/format';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ErrorState, SkeletonBlock } from '../components/ui/Feedback';
import { StatusBadge } from '../components/ui/Badge';
import Tabs from '../components/ui/Tabs';
import { CategoryBarChart, MonthlyActivityChart, RankedList } from '../components/charts/DashboardCharts';
import MemberDashboard from './MemberDashboard';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_ACTIONS = [
  { to: '/circulation?tab=issue', label: 'Issue a book', icon: ArrowLeftRight, primary: true },
  { to: '/circulation?tab=return', label: 'Return a book', icon: Undo2 },
  { to: '/books?new=1', label: 'Add a book', icon: BookPlus },
  { to: '/members?new=1', label: 'Register member', icon: UserPlus },
];

function RecentActivity({ recent, currency }) {
  const [tab, setTab] = useState('issued');
  const tabs = [
    { value: 'issued', label: 'Issued', count: recent.issued.length },
    { value: 'returned', label: 'Returned', count: recent.returned.length },
    { value: 'overdue', label: 'Overdue', count: recent.overdue.length },
    { value: 'added', label: 'New books', count: recent.addedBooks.length },
  ];

  const rows =
    tab === 'added'
      ? recent.addedBooks.map((b) => ({
          id: b._id,
          to: `/books/${b._id}`,
          title: b.title,
          sub: `${b.bookId} · ${b.category?.name || ''}`,
          right: <span className="text-xs text-stone-500">{formatDate(b.createdAt)}</span>,
        }))
      : recent[tab].map((t) => ({
          id: t._id,
          to: `/members/${t.member?._id}`,
          title: t.book?.title,
          sub: `${t.member?.name} · ${t.transactionId}`,
          right: (
            <div className="text-right">
              {tab === 'overdue' ? (
                <>
                  <p className="text-xs font-medium text-rose-600">{dueLabel(t.dueDate)}</p>
                  <p className="text-xs text-stone-500">{formatMoney(t.accruedFine, currency)} accrued</p>
                </>
              ) : (
                <>
                  <StatusBadge status={t.displayStatus} />
                  <p className="mt-1 text-xs text-stone-500">{formatDate(tab === 'returned' ? t.returnDate : t.issueDate)}</p>
                </>
              )}
            </div>
          ),
        }));

  return (
    <Card>
      <CardHeader title="Recent activity" />
      <div className="px-5 pt-1">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      <ul className="divide-y divide-stone-100">
        {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-400">Nothing here yet</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={r.to} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{r.title}</p>
                <p className="truncate text-xs text-stone-500">{r.sub}</p>
              </div>
              {r.right}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StaffDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => reportService.dashboard().then((r) => r.data), []);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const t = data?.totals;
  const currency = data?.currency;

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description="Here is what is happening at the circulation desk today."
      />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium transition sm:px-4 ${
              a.primary
                ? 'border-ink-800 bg-ink-800 text-white hover:bg-ink-700'
                : 'border-stone-200 bg-white text-stone-700 shadow-card hover:border-ink-300 hover:text-ink-800'
            }`}
          >
            <a.icon className={`h-4 w-4 shrink-0 ${a.primary ? 'text-brass-300' : 'text-ink-600'}`} aria-hidden />
            {a.label}
          </Link>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total books" value={formatNumber(t.totalBooks)} hint={`${t.titles} titles`} icon={Library} to="/books" />
          <StatCard label="Available" value={formatNumber(t.availableBooks)} hint={`${Math.round((t.availableBooks / Math.max(1, t.totalBooks)) * 100)}% on the shelf`} icon={BookOpenCheck} tone="green" to="/books?availability=available" />
          <StatCard label="Issued" value={formatNumber(t.issuedBooks)} hint={`${t.damagedCopies} damaged · ${t.lostCopies} lost`} icon={BookCopy} tone="blue" to="/transactions?status=ISSUED" />
          <StatCard label="Overdue" value={formatNumber(t.overdueBooks)} hint="Need follow-up" icon={AlertOctagon} tone="red" highlight={t.overdueBooks > 0} to="/transactions?status=OVERDUE" />
          <StatCard label="Members" value={formatNumber(t.totalMembers)} hint={`${t.suspendedMembers} suspended`} icon={Users} tone="ink" to="/members" />
          <StatCard label="Fines due" value={formatMoney(t.fines.pending, currency)} hint={`${formatMoney(t.fines.collected, currency)} collected · ${formatMoney(t.fines.accruing, currency)} accruing`} icon={Coins} tone="brass" to="/reports?tab=fines" />
        </div>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Circulation, last 12 months" description="Books issued and returned per month" />
              <CardBody>
                <MonthlyActivityChart data={data.charts.monthly} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Copies by category" />
              <CardBody>
                <CategoryBarChart data={data.charts.booksByCategory} />
              </CardBody>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <RecentActivity recent={data.recent} currency={currency} />
            </div>
            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader title="Most borrowed" actions={<Link to="/reports?tab=popular" className="text-xs font-medium text-ink-700 hover:underline">All</Link>} />
                <CardBody>
                  <RankedList items={data.charts.popularBooks} valueKey="issueCount" labelKey="title" subKey="category" valueLabel="loans" />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Most active members" />
                <CardBody>
                  <RankedList items={data.charts.topBorrowers} valueKey="loans" labelKey="name" subKey="memberId" valueLabel="loans" />
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  return user.role === ROLES.MEMBER ? <MemberDashboard /> : <StaffDashboard />;
}
