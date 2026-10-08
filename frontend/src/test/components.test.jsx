import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataTable from '../components/ui/DataTable';
import { AvailabilityBadge, StatusBadge } from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import InventoryBar from '../components/ui/InventoryBar';
import { makeBook } from './utils';

describe('DataTable', () => {
  const columns = [
    { key: 'title', header: 'Title', sortKey: 'title', mobile: 'title' },
    { key: 'author', header: 'Author' },
  ];
  const rows = [
    { _id: '1', title: 'Dune', author: 'Frank Herbert' },
    { _id: '2', title: 'Emma', author: 'Jane Austen' },
  ];

  it('renders a table and a phone card list with the same rows', () => {
    render(<DataTable columns={columns} rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    // Mobile list repeats each row as a card
    expect(screen.getAllByText('Dune')).toHaveLength(2);
  });

  it('works without sort props (regression: unsorted tables crashed)', () => {
    expect(() => render(<DataTable columns={columns} rows={rows} />)).not.toThrow();
  });

  it('toggles sort direction from the header', async () => {
    const onSortChange = vi.fn();
    render(<DataTable columns={columns} rows={rows} sort={{ sortBy: 'title', order: 'asc' }} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByRole('button', { name: /title/i }));
    expect(onSortChange).toHaveBeenCalledWith({ sortBy: 'title', order: 'desc' });
  });

  it('shows the empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} empty={<p>Nothing on the shelf</p>} />);
    expect(screen.getByText('Nothing on the shelf')).toBeInTheDocument();
  });

  it('calls onRowClick', async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />);
    await userEvent.click(within(screen.getByRole('table')).getByText('Emma'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
});

describe('status communication', () => {
  it.each([
    [{ availableCopies: 3, totalCopies: 5 }, 'Available'],
    [{ availableCopies: 1, totalCopies: 8 }, 'Low stock'],
    [{ availableCopies: 0, totalCopies: 2 }, 'Unavailable'],
    [{ availableCopies: 2, totalCopies: 2, status: 'INACTIVE' }, 'Withdrawn'],
  ])('availability %o -> %s', (overrides, label) => {
    render(<AvailabilityBadge book={makeBook(overrides)} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('labels transaction / member / fine statuses in words, not colour alone', () => {
    render(
      <>
        <StatusBadge status="OVERDUE" />
        <StatusBadge status="SUSPENDED" />
        <StatusBadge status="PENDING" />
      </>
    );
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText('Fine due')).toBeInTheDocument();
  });

  it('inventory bar exposes an accessible summary', () => {
    render(<InventoryBar book={makeBook()} />);
    expect(screen.getByRole('img', { name: '3 of 5 copies available' })).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('shows the range and disables Previous on page 1', async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={{ page: 1, limit: 10, total: 35, totalPages: 4 }} onPageChange={onPageChange} />);
    expect(screen.getByRole('navigation')).toHaveTextContent('Showing 1–10 of 35');
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe('ConfirmDialog', () => {
  it('runs the async action and closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Withdraw?" message="Sure?" confirmLabel="Withdraw" onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Withdraw?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open when the action fails', async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Delete?" onConfirm={() => Promise.reject(new Error('no'))} onClose={onClose} confirmLabel="Go" />);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
