import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Pencil, Plus, Tags } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { useForm } from '../hooks/useForm';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { categoryService } from '../services';
import { can } from '../utils/permissions';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { TextareaField, TextField } from '../components/ui/FormField';
import { Alert, EmptyState, ErrorState, SkeletonBlock } from '../components/ui/Feedback';
import { StatusBadge } from '../components/ui/Badge';

function CategoryForm({ category, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm(
    { name: category?.name || '', description: category?.description || '' },
    {
      validate: (v) => ({ name: v.name.trim().length < 2 && 'At least 2 characters' }),
      onSubmit: async (v) => {
        const res = category ? await categoryService.update(category._id, v) : await categoryService.create(v);
        toast.success(res.message);
        onSaved();
      },
    }
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={form.handleSubmit} noValidate className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <TextField label="Name" required maxLength={60} {...form.bind('name')} />
        <TextareaField label="Description" rows={3} maxLength={500} {...form.bind('description')} />
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  useDocumentTitle('Categories');
  const { user } = useAuth();
  const toast = useToast();
  const canManage = can(user, 'categories:manage');
  const [editing, setEditing] = useState(null);
  const [toggling, setToggling] = useState(null);
  const categories = useAsync(() => categoryService.list().then((r) => r.data), []);

  const toggle = async () => {
    try {
      const res =
        toggling.status === 'ACTIVE'
          ? await categoryService.deactivate(toggling._id)
          : await categoryService.update(toggling._id, { status: 'ACTIVE' });
      toast.success(res.message);
      categories.reload();
    } catch (err) {
      toast.error(err.message, { title: 'Not changed' });
      throw err;
    }
  };

  const list = categories.data || [];
  const maxCopies = Math.max(1, ...list.map((c) => c.totalCopies));

  return (
    <>
      <PageHeader
        title="Categories"
        description={canManage ? 'Organise the collection. Categories with active books cannot be deactivated.' : 'How the collection is organised.'}
        actions={canManage && <Button icon={Plus} onClick={() => setEditing('new')}>New category</Button>}
      />

      {categories.error && <ErrorState error={categories.error} onRetry={categories.reload} />}
      {categories.loading && !categories.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-36" />
          ))}
        </div>
      )}
      {categories.data && list.length === 0 && (
        <EmptyState icon={Tags} title="No categories yet" description="Create categories before adding books." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <article key={c._id} className={`card flex flex-col p-5 ${c.status === 'INACTIVE' ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                {c.status === 'INACTIVE' && <StatusBadge status="INACTIVE" />}
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setToggling(c)}
                    aria-label={c.status === 'ACTIVE' ? `Deactivate ${c.name}` : `Reactivate ${c.name}`}
                  >
                    {c.status === 'ACTIVE' ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-1 line-clamp-2 flex-1 text-sm text-stone-500">{c.description || 'No description'}</p>
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-ink-600" style={{ width: `${(c.totalCopies / maxCopies) * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-stone-600 tabular">
                  <strong className="text-stone-900">{c.bookCount}</strong> titles · <strong className="text-stone-900">{c.totalCopies}</strong> copies
                </span>
                <Link to={`/books?category=${c._id}`} className="text-xs font-medium text-ink-700 hover:underline">
                  View books
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            categories.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(toggling)}
        onClose={() => setToggling(null)}
        onConfirm={toggle}
        tone={toggling?.status === 'ACTIVE' ? 'danger' : 'primary'}
        title={toggling?.status === 'ACTIVE' ? `Deactivate "${toggling?.name}"?` : `Reactivate "${toggling?.name}"?`}
        confirmLabel={toggling?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
        message={
          toggling?.status === 'ACTIVE'
            ? toggling?.bookCount > 0
              ? `It still has ${toggling.bookCount} active book(s); move them to another category first.`
              : 'New books can no longer be filed under it.'
            : 'It will be available for new books again.'
        }
      />
    </>
  );
}
