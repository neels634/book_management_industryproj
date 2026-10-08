import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { SelectField, TextareaField, TextField } from '../ui/FormField';
import { Alert } from '../ui/Feedback';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { bookService } from '../../services';
import { isValidIsbn } from '../../utils/validation';

const toForm = (book) => ({
  title: book?.title || '',
  subtitle: book?.subtitle || '',
  isbn: book?.isbn || '',
  authors: book?.authors?.join(', ') || '',
  publisher: book?.publisher || '',
  publishedYear: book?.publishedYear || '',
  edition: book?.edition || '',
  language: book?.language || 'English',
  pages: book?.pages || '',
  category: book?.category?._id || book?.category || '',
  shelfLocation: book?.shelfLocation || '',
  price: book?.price ?? '',
  totalCopies: book?.totalCopies ?? 1,
  description: book?.description || '',
});

function validate(v, book) {
  const year = Number(v.publishedYear);
  const minCopies = book ? book.totalCopies - book.availableCopies : 1;
  return {
    title: !v.title.trim() && 'Title is required',
    isbn: !v.isbn.trim() ? 'ISBN is required' : !isValidIsbn(v.isbn) && 'Not a valid ISBN-10 / ISBN-13 (check digit)',
    authors: !v.authors.trim() && 'At least one author',
    category: !v.category && 'Choose a category',
    publishedYear: v.publishedYear !== '' && (year < 1000 || year > new Date().getFullYear() + 1) && 'Enter a valid year',
    totalCopies:
      (!Number.isInteger(Number(v.totalCopies)) || Number(v.totalCopies) < Math.max(minCopies, book ? 0 : 1)) &&
      (book
        ? `Cannot be below ${minCopies} (copies currently on loan, damaged or lost)`
        : 'At least one copy'),
    price: v.price !== '' && Number(v.price) < 0 && 'Price cannot be negative',
  };
}

/** Add / edit a book. Inventory counters are managed by the server. */
export default function BookFormModal({ open, onClose, book, categories, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(book);
  const form = useForm(toForm(book), {
    validate: (v) => validate(v, book),
    onSubmit: async (v) => {
      const payload = {
        ...v,
        authors: v.authors.split(',').map((a) => a.trim()).filter(Boolean),
        publishedYear: v.publishedYear === '' ? undefined : Number(v.publishedYear),
        pages: v.pages === '' ? undefined : Number(v.pages),
        price: v.price === '' ? undefined : Number(v.price),
        totalCopies: Number(v.totalCopies),
      };
      const res = isEdit ? await bookService.update(book._id, payload) : await bookService.create(payload);
      toast.success(res.message, { title: isEdit ? 'Saved' : `${res.data.bookId} created` });
      onSaved(res.data);
    },
  });
  const { bind, handleSubmit, submitting, formError } = form;
  const activeCategories = categories.filter((c) => c.status === 'ACTIVE' || c._id === book?.category?._id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${book.bookId}` : 'Add a book'}
      description={isEdit ? book.title : 'Each title is registered once by ISBN; set how many physical copies you hold.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="book-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Add book'}
          </Button>
        </>
      }
    >
      <form id="book-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField label="Title" required maxLength={200} {...bind('title')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="ISBN" required placeholder="978-0-13-468599-1" hint="ISBN-10 or ISBN-13; hyphens optional" {...bind('isbn')} />
          <SelectField
            label="Category"
            required
            placeholder="Select a category"
            options={activeCategories.map((c) => ({ value: c._id, label: c.name }))}
            {...bind('category')}
          />
        </div>
        <TextField label="Author(s)" required placeholder="Separate multiple authors with commas" {...bind('authors')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Publisher" className="sm:col-span-2" {...bind('publisher')} />
          <TextField label="Year" type="number" inputMode="numeric" {...bind('publishedYear')} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextField
            label={isEdit ? 'Total copies' : 'Copies'}
            type="number"
            min={0}
            required
            inputMode="numeric"
            {...bind('totalCopies')}
          />
          <TextField label="Replacement price" type="number" min={0} step="0.01" hint="Charged if lost" {...bind('price')} />
          <TextField label="Shelf" placeholder="e.g. T-03" {...bind('shelfLocation')} />
          <TextField label="Language" {...bind('language')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Edition" {...bind('edition')} />
          <TextField label="Pages" type="number" min={1} {...bind('pages')} />
        </div>
        <TextareaField label="Description" rows={3} maxLength={2000} {...bind('description')} />
        {isEdit && (
          <p className="text-xs text-stone-500">
            Changing total copies adds or removes copies <em>on the shelf</em>. To record damaged, repaired or found copies use
            &ldquo;Adjust inventory&rdquo; on the book page.
          </p>
        )}
      </form>
    </Modal>
  );
}
