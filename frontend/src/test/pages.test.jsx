import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, USERS, SETTINGS, paged, makeBook } from './utils';

vi.mock('../services', () => ({
  authService: { login: vi.fn(), me: vi.fn(), logout: vi.fn(), changePassword: vi.fn() },
  bookService: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), history: vi.fn(), adjustCopies: vi.fn() },
  categoryService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() },
  memberService: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), history: vi.fn() },
  transactionService: { list: vi.fn(), get: vi.fn(), issue: vi.fn(), return: vi.fn(), renew: vi.fn(), markLost: vi.fn(), settleFine: vi.fn() },
  reportService: {},
  settingService: { get: vi.fn(), update: vi.fn() },
  userService: {},
}));

// eslint-disable-next-line import/first
import { bookService, categoryService, memberService, transactionService } from '../services';
import LoginPage from '../pages/LoginPage';
import BooksPage from '../pages/books/BooksPage';
import MembersPage from '../pages/members/MembersPage';
import CirculationPage, { eligibilityProblems } from '../pages/CirculationPage';
import LoanActionDialogs from '../components/transactions/LoanActionDialogs';
import ProtectedRoute from '../routes/ProtectedRoute';

const CATEGORIES = [
  { _id: 'c1', name: 'Technology', status: 'ACTIVE' },
  { _id: 'c2', name: 'Fiction', status: 'ACTIVE' },
];

beforeEach(() => {
  vi.clearAllMocks();
  categoryService.list.mockResolvedValue({ data: CATEGORIES });
});

describe('Login', () => {
  it('shows field errors when submitted empty', async () => {
    const login = vi.fn();
    renderWithProviders(<LoginPage />, { user: null, auth: { login } });
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Enter your username')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('submits credentials and shows API errors', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid username or password'));
    renderWithProviders(<LoginPage />, { user: null, auth: { login } });
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(login).toHaveBeenCalledWith({ username: 'admin', password: 'wrong-pass' });
    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
  });
});

describe('Route protection', () => {
  it('redirects anonymous visitors to login', () => {
    renderWithProviders(
      <ProtectedRoute>
        <p>Secret</p>
      </ProtectedRoute>,
      { user: null, route: '/members' }
    );
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('shows "no access" for the wrong role', () => {
    renderWithProviders(
      <ProtectedRoute roles={['ADMIN', 'LIBRARIAN']}>
        <p>Staff area</p>
      </ProtectedRoute>,
      { user: USERS.MEMBER, route: '/reports' }
    );
    expect(screen.queryByText('Staff area')).not.toBeInTheDocument();
    expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
  });
});

describe('Books page', () => {
  beforeEach(() => {
    bookService.list.mockResolvedValue(paged([makeBook({ _id: 'b1' }), makeBook({ _id: 'b2', title: 'Dune', availableCopies: 0, issuedCopies: 5 })]));
  });

  it('lists books with availability', async () => {
    renderWithProviders(<BooksPage />, { route: '/books' });
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Clean Code')).toBeInTheDocument();
    expect(within(table).getByText('Unavailable')).toBeInTheDocument();
  });

  it('searches and filters through the API', async () => {
    renderWithProviders(<BooksPage />, { route: '/books' });
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('Search'), 'dune');
    await waitFor(() => expect(bookService.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'dune' })));
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'c2');
    await waitFor(() => expect(bookService.list).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'c2', q: 'dune' })));
    await userEvent.selectOptions(screen.getByLabelText('Availability'), 'available');
    await waitFor(() => expect(bookService.list).toHaveBeenLastCalledWith(expect.objectContaining({ availability: 'available' })));
  });

  it('validates the add-book form before calling the API', async () => {
    renderWithProviders(<BooksPage />, { route: '/books' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add book' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/ISBN/), '978-0-13-468599-2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add book' }));
    expect(within(dialog).getByText('Title is required')).toBeInTheDocument();
    expect(within(dialog).getByText(/check digit/)).toBeInTheDocument();
    expect(bookService.create).not.toHaveBeenCalled();
  });

  it('creates a book with a normalised payload', async () => {
    bookService.create.mockResolvedValue({ data: makeBook({ _id: 'new', bookId: 'BK-00099' }), message: 'Book added' });
    renderWithProviders(<BooksPage />, { route: '/books' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add book' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Title/), 'Refactoring');
    await userEvent.type(within(dialog).getByLabelText(/ISBN/), '978-0-13-468599-1');
    await userEvent.type(within(dialog).getByLabelText(/Author/), 'Martin Fowler, Kent Beck');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Category/), 'c1');
    await userEvent.clear(within(dialog).getByLabelText(/^Copies/));
    await userEvent.type(within(dialog).getByLabelText(/^Copies/), '4');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add book' }));
    await waitFor(() =>
      expect(bookService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Refactoring', authors: ['Martin Fowler', 'Kent Beck'], category: 'c1', totalCopies: 4 })
      )
    );
  });

  it('shows server-side field errors (e.g. duplicate ISBN) in the form', async () => {
    const err = Object.assign(new Error('Validation failed'), { fieldErrors: { isbn: 'A book with this ISBN already exists' } });
    bookService.update.mockRejectedValue(err);
    renderWithProviders(<BooksPage />, { route: '/books' });
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getAllByRole('button', { name: /Edit/ })[0]);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('A book with this ISBN already exists')).toBeInTheDocument();
  });

  it('confirms before deactivating and reports API refusals', async () => {
    bookService.deactivate.mockRejectedValue(new Error('Cannot deactivate: 2 copy(ies) are still on loan'));
    renderWithProviders(<BooksPage />, { route: '/books' });
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getAllByRole('button', { name: /Deactivate/ })[0]);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Withdraw book' }));
    expect(bookService.deactivate).toHaveBeenCalledWith('b1');
    expect(await screen.findByText(/still on loan/)).toBeInTheDocument();
  });

  it('hides management controls from members', async () => {
    renderWithProviders(<BooksPage />, { route: '/books', user: USERS.MEMBER });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Add book' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deactivate/ })).not.toBeInTheDocument();
    expect(bookService.list).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });
});

describe('Members page', () => {
  it('validates and registers a member with an optional login', async () => {
    memberService.list.mockResolvedValue(paged([]));
    memberService.create.mockResolvedValue({ data: { _id: 'm9', memberId: 'MEM-00099' }, message: 'Member registered' });
    renderWithProviders(<MembersPage />, { route: '/members', user: USERS.LIBRARIAN });
    await userEvent.click(await screen.findByRole('button', { name: 'Register member' }));
    const dialog = screen.getByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText(/Phone/), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register member' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid phone number')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Priya Sharma');
    await userEvent.clear(within(dialog).getByLabelText(/Phone/));
    await userEvent.type(within(dialog).getByLabelText(/Phone/), '+91 98200 11111');
    await userEvent.click(within(dialog).getByLabelText(/Create a login/));
    await userEvent.type(within(dialog).getByLabelText('Username'), 'priya');
    await userEvent.type(within(dialog).getByLabelText(/Initial password/), 'Reader123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register member' }));
    await waitFor(() =>
      expect(memberService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Priya Sharma', borrowingLimit: 3, login: { username: 'priya', password: 'Reader123' } })
      )
    );
  });
});

describe('Circulation', () => {
  const memberDetail = (overrides = {}) => ({
    _id: 'm1',
    memberId: 'MEM-00001',
    name: 'Aarav',
    phone: '9999999999',
    membershipStatus: 'ACTIVE',
    borrowingLimit: 3,
    currentBorrowedCount: 1,
    activeLoans: [],
    stats: { overdueLoans: 0, pendingFines: 0 },
    ...overrides,
  });

  it('explains every reason a loan would be refused', () => {
    const problems = eligibilityProblems(
      memberDetail({
        membershipStatus: 'SUSPENDED',
        currentBorrowedCount: 3,
        stats: { overdueLoans: 1, pendingFines: 500 },
        activeLoans: [{ book: { _id: 'b1' } }],
      }),
      makeBook({ _id: 'b1', availableCopies: 0 }),
      SETTINGS
    );
    expect(problems.join(' ')).toMatch(/suspended/);
    expect(problems.join(' ')).toMatch(/limit reached/);
    expect(problems.join(' ')).toMatch(/overdue/);
    expect(problems.join(' ')).toMatch(/Unpaid fines/);
    expect(problems.join(' ')).toMatch(/already has this title/);
    expect(problems.join(' ')).toMatch(/No copies/);
    expect(eligibilityProblems(memberDetail(), makeBook(), SETTINGS)).toEqual([]);
  });

  it('issues a book after picking member and book', async () => {
    const member = memberDetail();
    const book = makeBook({ _id: 'b7', title: 'Sapiens' });
    memberService.list.mockResolvedValue({ data: [member] });
    memberService.get.mockResolvedValue({ data: member });
    bookService.list.mockResolvedValue({ data: [book] });
    transactionService.issue.mockResolvedValue({
      data: { transactionId: 'TXN-000123', book, member, dueDate: new Date().toISOString(), finePerDay: 5 },
      message: 'Issued "Sapiens" to Aarav',
    });

    renderWithProviders(<CirculationPage />, { route: '/circulation?tab=issue', user: USERS.LIBRARIAN });
    const issueButton = screen.getByRole('button', { name: 'Issue book' });
    expect(issueButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText(/name, member ID/), 'aar');
    await userEvent.click(await screen.findByText('Aarav'));
    await userEvent.type(screen.getByPlaceholderText(/title, author, ISBN/), 'sap');
    await userEvent.click(await screen.findByText('Sapiens'));

    await waitFor(() => expect(issueButton).toBeEnabled());
    await userEvent.click(issueButton);
    await waitFor(() => expect(transactionService.issue).toHaveBeenCalledWith(expect.objectContaining({ member: 'm1', book: 'b7' })));
    expect((await screen.findAllByText('TXN-000123')).length).toBeGreaterThan(0);
  });

  it('return dialog previews the fine (overdue days x rate + damage fee) and submits', async () => {
    const due = new Date();
    due.setDate(due.getDate() - 3);
    due.setHours(23, 59, 59, 999);
    const txn = {
      _id: 't1',
      transactionId: 'TXN-000001',
      book: { title: 'Dune' },
      member: { name: 'Aarav', memberId: 'MEM-00001' },
      issueDate: new Date(Date.now() - 20 * 86400000).toISOString(),
      dueDate: due.toISOString(),
      finePerDay: 5,
      isOverdue: true,
      status: 'ISSUED',
    };
    transactionService.return.mockResolvedValue({ data: { ...txn, status: 'RETURNED', fine: 115 }, message: 'Returned' });
    const onDone = vi.fn();
    renderWithProviders(<LoanActionDialogs action={{ type: 'return', txn }} onClose={() => {}} onDone={onDone} />, { user: USERS.LIBRARIAN });

    expect(screen.getByText('Fine due: ₹15')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Condition'), 'DAMAGED');
    expect(screen.getByText('Fine due: ₹115')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm return' }));
    await waitFor(() => expect(transactionService.return).toHaveBeenCalledWith(expect.objectContaining({ transaction: 't1', condition: 'DAMAGED' })));
    expect(onDone).toHaveBeenCalled();
  });
});
