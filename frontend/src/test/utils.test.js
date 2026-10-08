import { describe, expect, it, vi } from 'vitest';
import { isValidIsbn, isPhone, passwordProblem } from '../utils/validation';
import { dueLabel, formatMoney, initials } from '../utils/format';
import { can } from '../utils/permissions';
import { navFor } from '../layouts/navigation';

describe('validation', () => {
  it('accepts valid ISBN-10/13 with or without hyphens and rejects bad check digits', () => {
    expect(isValidIsbn('978-0-13-468599-1')).toBe(true);
    expect(isValidIsbn('0-306-40615-2')).toBe(true);
    expect(isValidIsbn('080442957X')).toBe(true);
    expect(isValidIsbn('978-0-13-468599-2')).toBe(false);
    expect(isValidIsbn('123')).toBe(false);
  });

  it('checks phones and password policy', () => {
    expect(isPhone('+91 98200 12345')).toBe(true);
    expect(isPhone('abc')).toBe(false);
    expect(passwordProblem('short')).toMatch(/8 characters/);
    expect(passwordProblem('onlyletters')).toMatch(/number/);
    expect(passwordProblem('Good1234')).toBe('');
  });
});

describe('formatting', () => {
  it('describes due dates relative to today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 10));
    expect(dueLabel(new Date(2026, 9, 8, 23, 59))).toBe('Due today');
    expect(dueLabel(new Date(2026, 9, 9, 23, 59))).toBe('Due tomorrow');
    expect(dueLabel(new Date(2026, 9, 13, 23, 59))).toBe('Due in 5 days');
    expect(dueLabel(new Date(2026, 9, 5, 23, 59))).toBe('3 days overdue');
    vi.useRealTimers();
  });

  it('formats money and initials', () => {
    expect(formatMoney(15, 'INR')).toContain('15');
    expect(initials('Asha Rao Kumar')).toBe('AR');
  });
});

describe('role permissions', () => {
  it('matches the role matrix', () => {
    const admin = { role: 'ADMIN' };
    const lib = { role: 'LIBRARIAN' };
    const member = { role: 'MEMBER' };
    expect(can(admin, 'categories:manage')).toBe(true);
    expect(can(lib, 'categories:manage')).toBe(false);
    expect(can(lib, 'circulation:manage')).toBe(true);
    expect(can(lib, 'fines:waive')).toBe(false);
    expect(can(member, 'books:manage')).toBe(false);
    expect(can(null, 'books:manage')).toBe(false);
  });

  it('builds navigation per role', () => {
    const labels = (role) => navFor(role).flatMap((s) => s.items.map((i) => i.label));
    expect(labels('ADMIN')).toEqual(
      expect.arrayContaining(['Dashboard', 'Books', 'Members', 'Issue / Return', 'Categories', 'Transactions', 'Reports', 'Settings'])
    );
    expect(labels('MEMBER')).toEqual(['Dashboard', 'My loans', 'Catalogue', 'Settings']);
  });
});
