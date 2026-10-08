const { z, objectId, dateRange, refineDateRange } = require('./common');
const { FINE_STATUS, TXN_STATUS } = require('../utils/constants');

const reportLimit = z.coerce.number().int().min(1).max(1000);

const overdue = z.object({
  category: objectId.optional(),
  member: objectId.optional(),
  limit: reportLimit.default(500),
});

const popularBooks = refineDateRange(
  z.object({
    ...dateRange,
    category: objectId.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
);

const booksReport = z.object({
  status: z.enum(['all', 'available', 'issued', 'unavailable', 'damaged', 'lost', 'inactive']).default('all'),
  category: objectId.optional(),
  limit: reportLimit.default(1000),
});

const categoryStats = refineDateRange(z.object({ ...dateRange }));

const fines = refineDateRange(
  z.object({
    ...dateRange,
    fineStatus: z.enum([FINE_STATUS.PENDING, FINE_STATUS.PAID, FINE_STATUS.WAIVED]).optional(),
    member: objectId.optional(),
    category: objectId.optional(),
    limit: reportLimit.default(1000),
  })
);

const memberHistory = refineDateRange(
  z.object({
    ...dateRange,
    member: objectId,
    status: z.enum(Object.values(TXN_STATUS)).optional(),
  })
);

const monthly = z.object({ months: z.coerce.number().int().min(1).max(24).default(12) });

module.exports = { overdue, popularBooks, booksReport, categoryStats, fines, memberHistory, monthly };
