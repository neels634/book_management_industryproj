const { z, money } = require('./common');

const updateSettings = z
  .object({
    libraryName: z.string().trim().min(2).max(100).optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code (e.g. INR, USD)')
      .optional(),
    finePerDay: money.optional(),
    loanPeriodDays: z.coerce.number().int().min(1).max(90).optional(),
    maxLoanPeriodDays: z.coerce.number().int().min(1).max(365).optional(),
    defaultBorrowingLimit: z.coerce.number().int().min(1).max(50).optional(),
    maxRenewals: z.coerce.number().int().min(0).max(10).optional(),
    lostBookFee: money.optional(),
    damagedBookFee: money.optional(),
    maxOutstandingFine: money.optional(),
    blockBorrowingWhenOverdue: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one setting to update');

module.exports = { updateSettings };
