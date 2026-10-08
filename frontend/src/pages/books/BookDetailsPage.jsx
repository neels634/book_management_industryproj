import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeftRight, PackagePlus, Pencil } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { useSettings } from '../../hooks/useSettings';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { bookService, categoryService } from '../../services';
import { can } from '../../utils/permissions';
import { COPY_ACTIONS } from '../../utils/constants';
import { dueLabel, formatDate, formatMoney } from '../../utils/format';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import InventoryBar from '../../components/ui/InventoryBar';
import { AvailabilityBadge, Badge } from '../../components/ui/Badge';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SelectField, TextField } from '../../components/ui/FormField';
import BookFormModal from '../../components/books/BookFormModal';
import { transactionColumns } from '../../components/transactions/transactionColumns';

function AdjustCopiesModal({ book, onClose, onDone }) {
  const toast = useToast();
  const [action, setAction] = useState('ADD');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = COPY_ACTIONS.find((a) => a.value === action);
  const maxQty = meta.from ? book[meta.from] : 10000;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await bookService.adjustCopies(book._id, { action, quantity: Number(quantity) });
      toast.success(res.message);
      onDone(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Adjust inventory"
      description={book.title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="copies-form" loading={busy} disabled={maxQty === 0}>
            Apply
          </Button>
        </>
      }
    >
      <form id="copies-form" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <SelectField
          label="What happened?"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          options={COPY_ACTIONS.map((a) => ({
            value: a.value,
            label: a.from ? `${a.label} (${book[a.from]} available)` : a.label,
            disabled: a.from && book[a.from] === 0,
          }))}
        />
        <TextField
          label="Number of copies"
          type="number"
          min={1}
          max={maxQty}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <InventoryBar book={book} showLegend />
      </form>
    </Modal>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-stone-800">{children || '—'}</dd>
    </div>
  );
}

export default function BookDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const canManage = can(user, 'books:manage');
  const [modal, setModal] = useState(null); // 'edit' | 'copies' | 'deactivate'
  const [historyPage, setHistoryPage] = useState(1);

  const book = useAsync(() => bookService.get(id).then((r) => r.data), [id]);
  const categories = useAsync(() => (canManage ? categoryService.list().then((r) => r.data) : Promise.resolve([])), []);
  const history = useAsync(
    () => (canManage ? bookService.history(id, { page: historyPage, limit: 8 }) : Promise.resolve(null)),
    [id, historyPage]
  );
  useDocumentTitle(book.data?.title);

  if (book.loading && !book.data) return <PageLoader />;
  if (book.error) return <ErrorState error={book.error} onRetry={book.reload} title="Could not load this book" />;
  const b = book.data;

  const refresh = () => {
    book.reload();
    history.reload();
  };

  const toggleStatus = async () => {
    try {
      const res =
        b.status === 'ACTIVE' ? await bookService.deactivate(b._id) : await bookService.update(b._id, { status: 'ACTIVE' });
      toast.success(res.message);
      refresh();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: '/books', label: canManage ? 'Books' : 'Catalogue' }}
        eyebrow={`${b.bookId} · ${b.category?.name}`}
        title={b.title}
        description={b.authors.join(', ')}
        actions={
          canManage && (
            <>
              {b.status === 'ACTIVE' && b.availableCopies > 0 && (
                <Link to={`/circulation?tab=issue&book=${b._id}`}>
                  <Button icon={ArrowLeftRight}>Issue</Button>
                </Link>
              )}
              <Button variant="secondary" icon={PackagePlus} onClick={() => setModal('copies')}>
                Adjust inventory
              </Button>
              <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>
                Edit
              </Button>
              <Button
                variant={b.status === 'ACTIVE' ? 'danger-ghost' : 'secondary'}
                icon={b.status === 'ACTIVE' ? Archive : ArchiveRestore}
                onClick={() => setModal('deactivate')}
              >
                {b.status === 'ACTIVE' ? 'Withdraw' : 'Reactivate'}
              </Button>
            </>
          )
        }
      />

      {b.status === 'INACTIVE' && (
        <Alert tone="warning" className="mb-6" title="Withdrawn from circulation">
          This book cannot be issued. Its loan history is kept for reporting.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Copies" actions={<AvailabilityBadge book={b} />} />
          <CardBody>
            <div className="mb-5 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold text-stone-900 tabular">{b.availableCopies}</span>
              <span className="text-stone-500">of {b.totalCopies} copies on the shelf</span>
            </div>
            <InventoryBar book={b} showLegend />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="ISBN">
                <span className="font-mono text-xs">{b.isbn}</span>
              </Detail>
              <Detail label="Shelf">{b.shelfLocation}</Detail>
              <Detail label="Publisher">{b.publisher}</Detail>
              <Detail label="Year">{b.publishedYear}</Detail>
              <Detail label="Language">{b.language}</Detail>
              <Detail label="Edition">{b.edition}</Detail>
              <Detail label="Pages">{b.pages}</Detail>
              <Detail label="Replacement">{b.price ? formatMoney(b.price, settings.currency) : null}</Detail>
              {canManage && <Detail label="Times issued">{b.totalIssues}</Detail>}
              {canManage && <Detail label="Added">{formatDate(b.createdAt)}</Detail>}
            </dl>
          </CardBody>
        </Card>
      </div>

      {b.description && (
        <Card className="mt-6">
          <CardBody>
            <p className="eyebrow mb-2">About this book</p>
            <p className="text-sm leading-relaxed text-stone-700">{b.description}</p>
          </CardBody>
        </Card>
      )}

      {canManage && (
        <>
          <Card className="mt-6">
            <CardHeader title="Currently on loan" description={`${b.activeLoans.length} copy(ies) with members`} />
            {b.activeLoans.length === 0 ? (
              <p className="px-5 py-6 text-sm text-stone-400">All copies are on the shelf.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {b.activeLoans.map((loan) => (
                  <li key={loan._id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link to={`/members/${loan.member?._id}`} className="min-w-0 hover:underline">
                      <p className="truncate text-sm font-medium text-stone-900">{loan.member?.name}</p>
                      <p className="text-xs text-stone-500">{loan.member?.memberId} · {loan.transactionId}</p>
                    </Link>
                    <div className="text-right">
                      <p className={`text-sm ${loan.isOverdue ? 'font-medium text-rose-600' : 'text-stone-700'}`}>{dueLabel(loan.dueDate)}</p>
                      {loan.isOverdue && <Badge tone="red">{formatMoney(loan.accruedFine, settings.currency)} accrued</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-6">
            <CardHeader title="Loan history" />
            <DataTable
              caption="Loan history"
              columns={transactionColumns({ currency: settings.currency, showBook: false })}
              rows={history.data?.data || []}
              loading={history.loading}
            />
            <Pagination meta={history.data?.meta} onPageChange={setHistoryPage} />
          </Card>
        </>
      )}

      {modal === 'edit' && (
        <BookFormModal
          open
          book={b}
          categories={categories.data || []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      {modal === 'copies' && (
        <AdjustCopiesModal
          book={b}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={modal === 'deactivate'}
        onClose={() => setModal(null)}
        onConfirm={toggleStatus}
        tone={b.status === 'ACTIVE' ? 'danger' : 'primary'}
        title={b.status === 'ACTIVE' ? 'Withdraw this book?' : 'Return this book to circulation?'}
        confirmLabel={b.status === 'ACTIVE' ? 'Withdraw' : 'Reactivate'}
        message={
          b.status === 'ACTIVE'
            ? b.issuedCopies > 0
              ? `${b.issuedCopies} copy(ies) are still on loan - they must come back (or be marked lost) first.`
              : 'It will no longer appear in the catalogue or be issuable. History is kept.'
            : 'Members will see it in the catalogue again and it can be issued.'
        }
      />
    </>
  );
}
