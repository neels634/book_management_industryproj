const { z, objectId, pagination, order, optionalText, date, dateRange, refineDateRange } = require('./common');
const { TXN_STATUS, FINE_STATUS, RETURN_CONDITION } = require('../utils/constants');

const issueBook = z.object({
  book: objectId,
  member: objectId,
  dueDate: date.optional(),
  remarks: optionalText(500),
});

const returnBook = z
  .object({
    // Identify the loan either directly or by book + member.
    transaction: objectId.optional(),
    book: objectId.optional(),
    member: objectId.optional(),
    returnDate: date.optional(),
    condition: z.enum(Object.values(RETURN_CONDITION)).default(RETURN_CONDITION.GOOD),
    remarks: optionalText(500),
  })
  .refine((v) => v.transaction || (v.book && v.member), {
    message: 'Provide either a transaction id, or both book and member',
    path: ['transaction'],
  });

const markLost = z.object({ remarks: optionalText(500) });

const renew = z.object({ remarks: optionalText(500) });

const settleFine = z.object({
  action: z.enum(['PAY', 'WAIVE']),
  remarks: optionalText(500),
});

const listTransactions = refineDateRange(
  z.object({
    ...pagination,
    ...dateRange,
    q: z.string().trim().max(100).optional(),
    status: z.enum(Object.values(TXN_STATUS)).optional(),
    fineStatus: z.enum(Object.values(FINE_STATUS)).optional(),
    member: objectId.optional(),
    book: objectId.optional(),
    sortBy: z.enum(['issueDate', 'dueDate', 'returnDate', 'fine', 'createdAt']).optional(),
    order,
  })
);

module.exports = { issueBook, returnBook, markLost, renew, settleFine, listTransactions };
