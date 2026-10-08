const { z } = require('zod');
const { isValidDate } = require('../utils/dates');

const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

const idParam = z.object({ id: objectId });

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

const order = z.enum(['asc', 'desc']).optional();

/** Accepts ISO strings / timestamps; rejects anything that is not a real date. */
const date = z
  .union([z.string().trim().min(1), z.number(), z.date()])
  .transform((value) => new Date(value))
  .refine(isValidDate, 'Must be a valid date');

const optionalText = (max) => z.string().trim().max(max).optional();

/** Treats "", null and undefined as "not provided". */
const blankToUndefined = (schema) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

const money = z.coerce.number().min(0).max(1_000_000);

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30)
  .regex(/^[a-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores');

/** from/to date range with from <= to. */
const dateRange = {
  from: date.optional(),
  to: date.optional(),
};

const refineDateRange = (schema) =>
  schema.refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '"from" date must be on or before "to" date',
    path: ['from'],
  });

module.exports = {
  z,
  objectId,
  idParam,
  pagination,
  order,
  date,
  optionalText,
  blankToUndefined,
  money,
  password,
  username,
  dateRange,
  refineDateRange,
};
