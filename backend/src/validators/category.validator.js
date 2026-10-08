const { z, optionalText } = require('./common');
const { CATEGORY_STATUS } = require('../utils/constants');

const name = z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(60);

const createCategory = z.object({
  name,
  description: optionalText(500),
});

const updateCategory = z
  .object({
    name: name.optional(),
    description: optionalText(500),
    status: z.enum(Object.values(CATEGORY_STATUS)).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const listCategories = z.object({
  status: z.enum(Object.values(CATEGORY_STATUS)).optional(),
  q: z.string().trim().max(60).optional(),
});

module.exports = { createCategory, updateCategory, listCategories };
