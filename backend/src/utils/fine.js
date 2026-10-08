const { DAY_MS } = require('./dates');

const roundMoney = (amount) => Math.round(amount * 100) / 100;

/**
 * Due dates are stored as the END of the due day (23:59:59.999), so a book
 * returned at any time on its due date is on time, and every started day after
 * that counts as one overdue day.
 *
 * Example: due 10 Oct (23:59:59), returned 13 Oct 10:00 -> 3 overdue days.
 */
function calculateOverdueDays(dueDate, referenceDate = new Date()) {
  const diff = new Date(referenceDate).getTime() - new Date(dueDate).getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

/** Fine = overdue days x daily fine rate (rate comes from library settings). */
function calculateOverdueFine(overdueDays, finePerDay) {
  if (!overdueDays || !finePerDay) return 0;
  return roundMoney(overdueDays * finePerDay);
}

module.exports = { calculateOverdueDays, calculateOverdueFine, roundMoney };
