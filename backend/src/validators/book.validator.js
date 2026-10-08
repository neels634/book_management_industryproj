const { z, objectId, pagination, order, optionalText, money } = require('./common');
const { normalizeIsbn, isValidIsbn } = require('../utils/isbn');
const { BOOK_STATUS, COPY_ACTIONS } = require('../utils/constants');

const currentYear = new Date().getFullYear();

const isbn = z
  .string({ required_error: 'ISBN is required' })
  .trim()
  .transform(normalizeIsbn)
  .refine(isValidIsbn, 'ISBN must be a valid ISBN-10 or ISBN-13 (check digit failed)');

const authors = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(',')))
  .transform((list) => list.map((a) => a.trim()).filter(Boolean))
  .refine((list) => list.length > 0, 'At least one author is required')
  .refine((list) => list.length <= 10, 'At most 10 authors')
  .refine((list) => list.every((a) => a.length <= 100), 'Author names must be at most 100 characters');

const fields = {
  title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title is required').max(200),
  subtitle: optionalText(200),
  isbn,
  authors,
  publisher: optionalText(120),
  publishedYear: z.coerce
    .number()
    .int()
    .min(1000, 'Published year looks invalid')
    .max(currentYear + 1, 'Published year cannot be in the future')
    .optional(),
  edition: optionalText(40),
  language: optionalText(40),
  pages: z.coerce.number().int().min(1).max(100000).optional(),
  category: objectId,
  description: optionalText(2000),
  shelfLocation: optionalText(40),
  price: money.optional(),
};

const createBook = z.object({
  ...fields,
  totalCopies: z.coerce.number().int('Copies must be a whole number').min(1, 'At least one copy is required').max(10000),
});

const updateBook = z
  .object({
    ...Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()])),
    totalCopies: z.coerce.number().int().min(0).max(10000).optional(),
    status: z.enum(Object.values(BOOK_STATUS)).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const listBooks = z.object({
  ...pagination,
  q: z.string().trim().max(100).optional(),
  category: objectId.optional(),
  status: z.enum(Object.values(BOOK_STATUS)).optional(),
  availability: z.enum(['available', 'unavailable']).optional(),
  author: z.string().trim().max(100).optional(),
  publisher: z.string().trim().max(120).optional(),
  language: z.string().trim().max(40).optional(),
  sortBy: z.enum(['title', 'createdAt', 'availableCopies', 'totalCopies', 'publishedYear', 'bookId']).optional(),
  order,
});

const adjustCopies = z.object({
  action: z.enum(Object.values(COPY_ACTIONS)),
  quantity: z.coerce.number().int().min(1).max(10000),
  remarks: optionalText(300),
});

module.exports = { createBook, updateBook, listBooks, adjustCopies };
