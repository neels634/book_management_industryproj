const { Category, Book } = require('../models');
const ApiError = require('../utils/ApiError');
const { CATEGORY_STATUS, BOOK_STATUS, ROLES } = require('../utils/constants');
const { containsRegex } = require('../utils/query');

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

async function assertNameAvailable(name, excludeId) {
  const filter = { name };
  if (excludeId) filter._id = { $ne: excludeId };
  const exists = await Category.findOne(filter).collation(CASE_INSENSITIVE).select('_id');
  if (exists) throw ApiError.conflict('DUPLICATE_CATEGORY', `Category "${name}" already exists`);
}

/** Categories with their title / copy counts (active books only). */
async function listCategories(query, user) {
  const filter = {};
  if (user.role === ROLES.MEMBER) filter.status = CATEGORY_STATUS.ACTIVE;
  else if (query.status) filter.status = query.status;
  if (query.q) filter.name = containsRegex(query.q);

  const [categories, counts] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).collation(CASE_INSENSITIVE),
    Book.aggregate([
      { $match: { status: BOOK_STATUS.ACTIVE } },
      {
        $group: {
          _id: '$category',
          bookCount: { $sum: 1 },
          totalCopies: { $sum: '$totalCopies' },
          availableCopies: { $sum: '$availableCopies' },
        },
      },
    ]),
  ]);
  const byId = new Map(counts.map((c) => [c._id.toString(), c]));
  return categories.map((category) => {
    const c = byId.get(category._id.toString());
    return {
      ...category.toJSON(),
      bookCount: c?.bookCount || 0,
      totalCopies: c?.totalCopies || 0,
      availableCopies: c?.availableCopies || 0,
    };
  });
}

async function getCategory(id) {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category');
  return category;
}

async function createCategory(data) {
  await assertNameAvailable(data.name);
  return Category.create(data);
}

async function updateCategory(id, changes) {
  const category = await getCategory(id);
  if (changes.name) await assertNameAvailable(changes.name, id);
  if (changes.status === CATEGORY_STATUS.INACTIVE && category.status !== CATEGORY_STATUS.INACTIVE) {
    await assertNoActiveBooks(id);
  }
  Object.assign(category, changes);
  return category.save();
}

async function assertNoActiveBooks(id) {
  const activeBooks = await Book.countDocuments({ category: id, status: BOOK_STATUS.ACTIVE });
  if (activeBooks > 0) {
    throw ApiError.conflict(
      'CATEGORY_IN_USE',
      `This category still has ${activeBooks} active book(s). Move or deactivate them first.`
    );
  }
}

/** Soft delete: books (and their history) keep pointing at the category. */
async function deactivateCategory(id) {
  return updateCategory(id, { status: CATEGORY_STATUS.INACTIVE });
}

module.exports = { listCategories, getCategory, createCategory, updateCategory, deactivateCategory };
