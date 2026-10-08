import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookPlus, Library, Pencil, Archive } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../hooks/useToast';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { bookService, categoryService } from '../../services';
import { can } from '../../utils/permissions';
import PageHeader from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import { SelectField } from '../../components/ui/FormField';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import InventoryBar from '../../components/ui/InventoryBar';
import { AvailabilityBadge } from '../../components/ui/Badge';
import { EmptyState, ErrorState } from '../../components/ui/Feedback';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BookFormModal from '../../components/books/BookFormModal';

const SORTS = [
  { value: 'title:asc', label: 'Title A–Z' },
  { value: 'title:desc', label: 'Title Z–A' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'availableCopies:desc', label: 'Most available' },
  { value: 'publishedYear:desc', label: 'Publication year' },
];

export default function BooksPage() {
  useDocumentTitle('Books');
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const canManage = can(user, 'books:manage');
  const [filters, setFilters] = useUrlFilters({ page: '1', limit: '10', sortBy: 'title', order: 'asc' });
  const [editing, setEditing] = useState(null); // null | 'new' | book
  const [deactivating, setDeactivating] = useState(null);

  // Dashboard quick action links here with ?new=1
  useEffect(() => {
    if (filters.new && canManage) {
      setEditing('new');
      setFilters({ new: '' });
    }
  }, [filters.new, canManage, setFilters]);

  const categories = useAsync(() => categoryService.list().then((r) => r.data), []);
  const books = useAsync(
    () =>
      bookService.list({
        q: filters.q,
        category: filters.category,
        availability: filters.availability,
        status: canManage ? filters.status || 'ACTIVE' : undefined,
        sortBy: filters.sortBy,
        order: filters.order,
        page: filters.page,
        limit: filters.limit,
      }),
    [filters.q, filters.category, filters.availability, filters.status, filters.sortBy, filters.order, filters.page, filters.limit]
  );

  const deactivate = async () => {
    try {
      const res = await bookService.deactivate(deactivating._id);
      toast.success(res.message);
      books.reload();
    } catch (err) {
      toast.error(err.message, { title: 'Could not deactivate' });
      throw err;
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Title',
      sortKey: 'title',
      mobile: 'title',
      render: (b) => (
        <div className="min-w-0 max-w-sm">
          <p className="font-medium text-stone-900">{b.title}</p>
          <p className="truncate text-xs text-stone-500">{b.authors.join(', ')}</p>
        </div>
      ),
    },
    {
      key: 'bookId',
      header: 'ID / ISBN',
      render: (b) => (
        <div className="font-mono text-xs">
          <p className="text-stone-700">{b.bookId}</p>
          <p className="text-stone-400">{b.isbn}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (b) => <span className="text-stone-700">{b.category?.name}</span> },
    {
      key: 'availableCopies',
      header: 'Copies',
      sortKey: 'availableCopies',
      render: (b) => <InventoryBar book={b} compact />,
    },
    { key: 'status', header: 'Availability', render: (b) => <AvailabilityBadge book={b} /> },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: '',
      mobile: 'full',
      className: 'w-px',
      render: (b) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(b)} aria-label={`Edit ${b.title}`}>
            <span className="md:sr-only">Edit</span>
          </Button>
          {b.status === 'ACTIVE' && (
            <Button size="sm" variant="danger-ghost" icon={Archive} onClick={() => setDeactivating(b)} aria-label={`Deactivate ${b.title}`}>
              <span className="md:sr-only">Deactivate</span>
            </Button>
          )}
        </div>
      ),
    });
  }

  const hasFilters = filters.q || filters.category || filters.availability;

  return (
    <>
      <PageHeader
        title={canManage ? 'Books' : 'Catalogue'}
        description={canManage ? 'Every title in the collection, with live copy counts.' : 'Browse the collection and check what is on the shelf.'}
        actions={canManage && <Button icon={BookPlus} onClick={() => setEditing('new')}>Add book</Button>}
      />

      <Card>
        <div className="grid grid-cols-2 gap-3 border-b border-stone-100 p-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <SearchInput
            value={filters.q || ''}
            onChange={(q) => setFilters({ q })}
            placeholder="Title, author, ISBN, publisher or ID"
            className="col-span-2 lg:col-span-1"
          />
          <SelectField
            aria-label="Category"
            value={filters.category || ''}
            onChange={(e) => setFilters({ category: e.target.value })}
            placeholder="All categories"
            options={(categories.data || []).filter((c) => c.status === 'ACTIVE').map((c) => ({ value: c._id, label: c.name }))}
          />
          <SelectField
            aria-label="Availability"
            value={filters.availability || ''}
            onChange={(e) => setFilters({ availability: e.target.value })}
            placeholder="Any availability"
            options={[
              { value: 'available', label: 'On the shelf' },
              { value: 'unavailable', label: 'All copies out' },
            ]}
          />
          {canManage ? (
            <SelectField
              aria-label="Status"
              value={filters.status || 'ACTIVE'}
              onChange={(e) => setFilters({ status: e.target.value === 'ACTIVE' ? '' : e.target.value })}
              options={[
                { value: 'ACTIVE', label: 'In circulation' },
                { value: 'INACTIVE', label: 'Withdrawn' },
              ]}
            />
          ) : (
            <div className="hidden lg:block" aria-hidden />
          )}
          <SelectField
            aria-label="Sort"
            value={`${filters.sortBy}:${filters.order}`}
            onChange={(e) => {
              const [sortBy, order] = e.target.value.split(':');
              setFilters({ sortBy, order });
            }}
            options={SORTS}
          />
        </div>

        {books.error ? (
          <ErrorState error={books.error} onRetry={books.reload} />
        ) : (
          <>
            <DataTable
              caption="Books"
              columns={columns}
              rows={books.data?.data || []}
              loading={books.loading}
              onRowClick={(b) => navigate(`/books/${b._id}`)}
              sort={{ sortBy: filters.sortBy, order: filters.order }}
              onSortChange={setFilters}
              empty={
                <EmptyState
                  icon={Library}
                  title={hasFilters ? 'No books match these filters' : 'No books yet'}
                  description={hasFilters ? 'Try a different search or clear the filters.' : 'Add the first title to start the catalogue.'}
                  action={
                    hasFilters ? (
                      <Button variant="secondary" onClick={() => setFilters({ q: '', category: '', availability: '' })}>
                        Clear filters
                      </Button>
                    ) : (
                      canManage && <Button onClick={() => setEditing('new')}>Add book</Button>
                    )
                  }
                />
              }
            />
            <Pagination
              meta={books.data?.meta}
              onPageChange={(page) => setFilters({ page })}
              onLimitChange={(limit) => setFilters({ limit })}
            />
          </>
        )}
      </Card>

      {editing && (
        <BookFormModal
          open
          book={editing === 'new' ? null : editing}
          categories={categories.data || []}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            books.reload();
            if (editing === 'new') navigate(`/books/${saved._id}`);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={deactivate}
        title="Withdraw this book?"
        confirmLabel="Withdraw book"
        message={
          <>
            <strong className="text-stone-900">{deactivating?.title}</strong> will be removed from the catalogue and can no longer be
            issued. Its loan history stays intact, and it can be reactivated later.
          </>
        }
      />
    </>
  );
}
