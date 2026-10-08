/** Client-side checks mirroring the API rules, for instant feedback. The API remains the authority. */

export function isValidIsbn(raw) {
  const isbn = String(raw || '').replace(/[\s-]/g, '').toUpperCase();
  if (isbn.length === 10) {
    if (!/^\d{9}[\dX]$/.test(isbn)) return false;
    const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const isPhone = (value) => /^\+?[0-9][0-9\s-]{6,18}$/.test(value.trim());

export function passwordProblem(value) {
  if (!value || value.length < 8) return 'At least 8 characters';
  if (!/[A-Za-z]/.test(value)) return 'Must contain a letter';
  if (!/\d/.test(value)) return 'Must contain a number';
  return '';
}
