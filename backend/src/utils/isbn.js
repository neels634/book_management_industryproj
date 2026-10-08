/** Strips hyphens and spaces: "978-0-13-468599-1" -> "9780134685991". */
function normalizeIsbn(value) {
  return String(value || '').replace(/[\s-]/g, '').toUpperCase();
}

function isValidIsbn10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const digit = isbn[i] === 'X' ? 10 : Number(isbn[i]);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

function isValidIsbn13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);
  return isbn.length === 10 ? isValidIsbn10(isbn) : isValidIsbn13(isbn);
}

/** Builds a checksum-valid ISBN-13 from a 12-digit prefix (used by seed data and tests). */
function completeIsbn13(prefix12) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(prefix12[i]) * (i % 2 === 0 ? 1 : 3);
  return `${prefix12}${(10 - (sum % 10)) % 10}`;
}

module.exports = { normalizeIsbn, isValidIsbn, isValidIsbn10, isValidIsbn13, completeIsbn13 };
