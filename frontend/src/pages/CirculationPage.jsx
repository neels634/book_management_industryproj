import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, CheckCircle2, Undo2, User } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../hooks/useToast';
import { useSettings } from '../hooks/useSettings';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { bookService, memberService, transactionService } from '../services';
import { addDays, dueLabel, formatDate, formatMoney, toDateInput } from '../utils/format';
import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import EntityPicker from '../components/ui/EntityPicker';
import { TextField, TextareaField } from '../components/ui/FormField';
import { Alert, EmptyState } from '../components/ui/Feedback';
import { AvailabilityBadge, StatusBadge } from '../components/ui/Badge';
import InventoryBar from '../components/ui/InventoryBar';
import SearchInput from '../components/ui/SearchInput';
import LoanActionDialogs from '../components/transactions/LoanActionDialogs';
import LoanActionsMenu from '../components/transactions/LoanActionsMenu';

const searchMembers = (q) => memberService.list({ q, limit: 8, status: 'ACTIVE' }).then((r) => r.data);
const searchBooks = (q) => bookService.list({ q, limit: 8, status: 'ACTIVE' }).then((r) => r.data);

function MemberOption({ member, selected }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">{member.name}</p>
        <p className="text-xs text-stone-500">
          {member.memberId} · {member.phone}
        </p>
      </div>
      <span className={`shrink-0 text-xs tabular ${member.currentBorrowedCount >= member.borrowingLimit ? 'font-medium text-amber-700' : 'text-stone-500'}`}>
        {member.currentBorrowedCount}/{member.borrowingLimit} {selected ? 'books out' : ''}
      </span>
    </div>
  );
}

function BookOption({ book }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">{book.title}</p>
        <p className="truncate text-xs text-stone-500">
          {book.bookId} · {book.authors.join(', ')}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <AvailabilityBadge book={book} />
        <p className="mt-0.5 text-xs text-stone-500 tabular">{book.availableCopies} free</p>
      </div>
    </div>
  );
}

/** Client-side eligibility preview; the server re-checks every rule when issuing. */
export function eligibilityProblems(memberDetail, book, settings) {
  const problems = [];
  if (memberDetail) {
    const m = memberDetail;
    if (m.membershipStatus !== 'ACTIVE') problems.push(`Membership is ${m.membershipStatus.toLowerCase()}.`);
    if (m.membershipExpiry && new Date(m.membershipExpiry) < new Date()) problems.push('Membership has expired.');
    if (m.currentBorrowedCount >= m.borrowingLimit) problems.push(`Borrowing limit reached (${m.borrowingLimit}).`);
    if (settings.blockBorrowingWhenOverdue && m.stats.overdueLoans > 0) problems.push(`${m.stats.overdueLoans} overdue book(s) must be returned first.`);
    if (m.stats.pendingFines > settings.maxOutstandingFine)
      problems.push(`Unpaid fines ${formatMoney(m.stats.pendingFines, settings.currency)} exceed the ${formatMoney(settings.maxOutstandingFine, settings.currency)} limit.`);
    if (book && m.activeLoans.some((l) => l.book?._id === book._id)) problems.push('Member already has this title on loan.');
  }
  if (book && book.availableCopies <= 0) problems.push('No copies of this book are available.');
  return problems;
}

function IssuePanel({ initialMemberId, initialBookId }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [member, setMember] = useState(null);
  const [book, setBook] = useState(null);
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  // Preselect from ?member= / ?book= (links from the member and book pages).
  useEffect(() => {
    if (initialMemberId) memberService.get(initialMemberId).then((r) => setMember(r.data)).catch(() => {});
    if (initialBookId) bookService.get(initialBookId).then((r) => setBook(r.data)).catch(() => {});
  }, [initialMemberId, initialBookId]);

  const memberDetail = useAsync(() => (member ? memberService.get(member._id).then((r) => r.data) : Promise.resolve(null)), [member?._id]);
  const defaultDue = toDateInput(addDays(new Date(), settings.loanPeriodDays));
  useEffect(() => setDueDate(defaultDue), [defaultDue]);

  const problems = useMemo(() => eligibilityProblems(memberDetail.data, book, settings), [memberDetail.data, book, settings]);
  const ready = member && book && problems.length === 0 && !memberDetail.loading;

  const reset = () => {
    setBook(null);
    setRemarks('');
    setError('');
    setDueDate(defaultDue);
    memberDetail.reload();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError('');
    try {
      const body = { member: member._id, book: book._id, remarks: remarks || undefined };
      if (dueDate && dueDate !== defaultDue) body.dueDate = new Date(`${dueDate}T12:00:00`).toISOString();
      const res = await transactionService.issue(body);
      toast.success(res.message, { title: res.data.transactionId });
      setReceipt(res.data);
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <form onSubmit={submit}>
          <CardBody className="space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-white">1</span>
                <h2 className="font-semibold text-stone-900">Member</h2>
              </div>
              <EntityPicker
                placeholder="Search by name, member ID or phone"
                search={searchMembers}
                value={member && memberDetail.data?._id === member._id ? memberDetail.data : member}
                onChange={setMember}
                renderOption={(m, selected) => <MemberOption member={m} selected={selected} />}
                emptyText="No active members match"
                autoFocus={!initialMemberId}
              />
              {memberDetail.data && memberDetail.data.activeLoans.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-stone-600">
                  {memberDetail.data.activeLoans.map((l) => (
                    <li key={l._id} className="flex justify-between gap-3">
                      <span className="truncate">{l.book?.title}</span>
                      <span className={l.isOverdue ? 'shrink-0 font-medium text-rose-600' : 'shrink-0'}>{dueLabel(l.dueDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-white">2</span>
                <h2 className="font-semibold text-stone-900">Book</h2>
              </div>
              <EntityPicker
                placeholder="Search by title, author, ISBN or book ID"
                search={searchBooks}
                value={book}
                onChange={setBook}
                renderOption={(b) => <BookOption book={b} />}
                emptyText="No books in circulation match"
              />
              {book && (
                <div className="mt-3">
                  <InventoryBar book={book} />
                  <p className="mt-1 text-xs text-stone-500">
                    {book.availableCopies} of {book.totalCopies} copies on the shelf
                    {book.shelfLocation && ` · shelf ${book.shelfLocation}`}
                  </p>
                </div>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Due date"
                type="date"
                value={dueDate}
                min={toDateInput()}
                max={toDateInput(addDays(new Date(), settings.maxLoanPeriodDays))}
                onChange={(e) => setDueDate(e.target.value)}
                hint={`Default loan period: ${settings.loanPeriodDays} days`}
              />
              <TextareaField label="Remarks" rows={1} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
            </section>

            {problems.length > 0 && (
              <Alert tone="warning" title="This loan cannot be issued">
                <ul className="list-disc pl-4">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {error && <Alert tone="error">{error}</Alert>}
          </CardBody>
          <div className="flex justify-end border-t border-stone-100 px-5 py-3">
            <Button type="submit" size="lg" icon={ArrowLeftRight} loading={submitting} disabled={!ready} className="w-full sm:w-auto">
              Issue book
            </Button>
          </div>
        </form>
      </Card>

      <aside className="space-y-4">
        {receipt ? (
          <Card className="border-emerald-200">
            <CardBody>
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <p className="font-semibold">Issued</p>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Transaction</dt>
                  <dd className="font-mono text-xs">{receipt.transactionId}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Book</dt>
                  <dd className="truncate text-right font-medium">{receipt.book.title}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Member</dt>
                  <dd>{receipt.member.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Due</dt>
                  <dd className="font-semibold">{formatDate(receipt.dueDate)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-stone-500">
                Late returns are charged {formatMoney(receipt.finePerDay, settings.currency)} per day.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="text-sm text-stone-600">
              <p className="eyebrow mb-2">Loan policy</p>
              <ul className="space-y-1.5">
                <li>Loan period: <strong>{settings.loanPeriodDays} days</strong></li>
                <li>Late fine: <strong>{formatMoney(settings.finePerDay, settings.currency)} / day</strong></li>
                <li>Renewals allowed: <strong>{settings.maxRenewals}</strong></li>
                <li>Borrowing blocked above <strong>{formatMoney(settings.maxOutstandingFine, settings.currency)}</strong> unpaid fines</li>
              </ul>
            </CardBody>
          </Card>
        )}
      </aside>
    </div>
  );
}

function ReturnPanel() {
  const { settings } = useSettings();
  const [q, setQ] = useState('');
  const [action, setAction] = useState(null);
  const [lastReturned, setLastReturned] = useState(null);
  const loans = useAsync(
    () => transactionService.list({ status: 'ISSUED', q, limit: 20, sortBy: 'dueDate', order: 'asc' }),
    [q]
  );

  return (
    <Card>
      <CardHeader
        title="Books currently out"
        description="Find the loan by member, book title, book ID or transaction ID."
        actions={<span className="text-xs text-stone-500 tabular">{loans.data?.meta?.total ?? 0} open loans</span>}
      />
      <div className="border-b border-stone-100 p-4">
        <SearchInput value={q} onChange={setQ} placeholder="e.g. Aarav, Clean Code, BK-00017, TXN-000071" />
      </div>
      {lastReturned && (
        <div className="px-4 pt-4">
          <Alert tone={lastReturned.fine > 0 ? 'warning' : 'success'} title={`Returned: ${lastReturned.book.title}`}>
            {lastReturned.fine > 0
              ? `Fine of ${formatMoney(lastReturned.fine, settings.currency)} added to ${lastReturned.member.name}'s account.`
              : 'No fine due.'}{' '}
            {lastReturned.fine > 0 && (
              <button type="button" className="font-semibold underline" onClick={() => setAction({ type: 'fine', txn: lastReturned })}>
                Collect now
              </button>
            )}
          </Alert>
        </div>
      )}
      {!loans.loading && loans.data?.data.length === 0 ? (
        <EmptyState icon={BookOpen} title={q ? 'No open loan matches' : 'No books are out'} description={q ? 'Check the spelling, or search by member ID.' : undefined} />
      ) : (
        <ul className="divide-y divide-stone-100">
          {(loans.data?.data || []).map((t) => (
            <li key={t._id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{t.book?.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                  <User className="h-3 w-3" aria-hidden />
                  <Link to={`/members/${t.member?._id}`} className="hover:underline">
                    {t.member?.name} ({t.member?.memberId})
                  </Link>
                  <span>· {t.transactionId}</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-sm ${t.isOverdue ? 'font-medium text-rose-600' : 'text-stone-700'}`}>{dueLabel(t.dueDate)}</p>
                  {t.isOverdue ? (
                    <p className="text-xs text-amber-700">{formatMoney(t.accruedFine, settings.currency)} accrued</p>
                  ) : (
                    <p className="text-xs text-stone-400">Due {formatDate(t.dueDate)}</p>
                  )}
                </div>
                <StatusBadge status={t.displayStatus} />
              </div>
              <LoanActionsMenu txn={t} onAction={setAction} compact />
            </li>
          ))}
        </ul>
      )}
      <LoanActionDialogs
        action={action}
        onClose={() => setAction(null)}
        onDone={(updated, type) => {
          if (type === 'return') setLastReturned(updated);
          if (type === 'fine') setLastReturned(null);
          loans.reload();
        }}
      />
    </Card>
  );
}

export default function CirculationPage() {
  useDocumentTitle('Issue / Return');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'return' ? 'return' : 'issue';

  return (
    <>
      <PageHeader title="Circulation desk" description="Lend books to members and check them back in." />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={(value) => setParams({ tab: value }, { replace: true })}
        tabs={[
          { value: 'issue', label: 'Issue a book', icon: ArrowLeftRight },
          { value: 'return', label: 'Return a book', icon: Undo2 },
        ]}
      />
      {tab === 'issue' ? <IssuePanel initialMemberId={params.get('member')} initialBookId={params.get('book')} /> : <ReturnPanel />}
    </>
  );
}
