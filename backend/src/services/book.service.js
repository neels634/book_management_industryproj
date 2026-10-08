const { Book, Category, Transaction } = require('../models');
const ApiError = require('../utils/ApiError');
const { nextId } = require('./sequence.service');
const { BOOK_STATUS, CATEGORY_STATUS, COPY_ACTIONS, ROLES, TXN_STATUS } = require('../utils/constants');
const { containsRegex, paginationFrom, sortFrom } = require('../utils/query');

const LIST_SORT_FIELDS = ['title', 'createdAt', 'availableCopies', 'totalCopies', 'publishedYear', 'bookId'];

async function assertActiveCategory(categoryId) {
  const category = await Category.findById(categoryId).select('status');
  if (!category) throw ApiError.badRequest('Selected category does not exist', 'CATEGORY_NOT_FOUND');
  if (category.status !== CATEGORY_STATUS.ACTIVE) {
    throw ApiError.badRequest('Selected category is inactive', 'CATEGORY_INACTIVE');
  }
}

async function assertIsbnAvailable(isbn, excludeId) {
  const filter = { isbn };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Book.findOne(filter).select('bookId title');
  if (existing) {
    throw ApiError.conflict(
      'DUPLICATE_ISBN',
      `ISBN already registered to ${existing.bookId} "${existing.title}". Add copies to that book instead.`
    );
  }
}

async function listBooks(query, user) {
  const { page, limit, skip } = paginationFrom(query);
  const filter = {};

  // Members only ever see the circulating catalogue.
  if (user.role === ROLES.MEMBER) filter.status = BOOK_STATUS.ACTIVE;
  else if (query.status) filter.status = query.status;

  if (query.category) filter.category = query.category;
  if (query.availability === 'available') filter.availableCopies = { $gt: 0 };
  if (query.availability === 'unavailable') filter.availableCopies = 0;
  if (query.author) filter.authors = containsRegex(query.author);
  if (query.publisher) filter.publisher = containsRegex(query.publisher);
  if (query.language) filter.language = containsRegex(query.language);
  if (query.q) {
    const rx = containsRegex(query.q);
    const isbnRx = containsRegex(query.q.replace(/[\s-]/g, ''));
    filter.$or = [{ title: rx }, { authors: rx }, { publisher: rx }, { bookId: rx }, { isbn: isbnRx }];
  }

  const sort = sortFrom(query, LIST_SORT_FIELDS, 'title');
  const [items, total] = await Promise.all([
    Book.find(filter).populate('category', 'name status').sort(sort).skip(skip).limit(limit).collation({ locale: 'en' }),
    Book.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function getBook(id, user) {
  const book = await Book.findById(id).populate('category', 'name status').populate('createdBy', 'name');
  if (!book || (user.role === ROLES.MEMBER && book.status !== BOOK_STATUS.ACTIVE)) {
    throw ApiError.notFound('Book');
  }
  const result = book.toJSON();

  if (user.role !== ROLES.MEMBER) {
    const [activeLoans, totalIssues] = await Promise.all([
      Transaction.find({ book: book._id, status: TXN_STATUS.ISSUED })
        .populate('member', 'memberId name')
        .sort({ dueDate: 1 }),
      Transaction.countDocuments({ book: book._id }),
    ]);
    result.activeLoans = activeLoans;
    result.totalIssues = totalIssues;
  }
  return result;
}

async function createBook(data, actor) {
  await assertActiveCategory(data.category);
  await assertIsbnAvailable(data.isbn);
  const book = await Book.create({
    ...data,
    bookId: await nextId('book'),
    totalCopies: data.totalCopies,
    availableCopies: data.totalCopies,
    issuedCopies: 0,
    damagedCopies: 0,
    lostCopies: 0,
    status: BOOK_STATUS.ACTIVE,
    createdBy: actor.id,
  });
  return book.populate('category', 'name status');
}

/**
 * Updates descriptive fields and, optionally, the total copy count. Changing
 * totalCopies adds/removes *available* copies, so the change is applied with
 * one conditional $inc that fails if it would push availableCopies below zero
 * (e.g. a copy was issued between loading the form and saving it).
 */
async function updateBook(id, changes) {
  const book = await Book.findById(id);
  if (!book) throw ApiError.notFound('Book');

  const { totalCopies, status, ...fields } = changes;
  if (fields.category && fields.category !== book.category.toString()) await assertActiveCategory(fields.category);
  if (fields.isbn && fields.isbn !== book.isbn) await assertIsbnAvailable(fields.isbn, id);

  const filter = { _id: id };
  const update = { $set: { ...fields } };

  if (totalCopies !== undefined && totalCopies !== book.totalCopies) {
    const delta = totalCopies - book.totalCopies;
    if (delta < 0) filter.availableCopies = { $gte: -delta };
    update.$inc = { totalCopies: delta, availableCopies: delta };
  }
  if (status && status !== book.status) {
    if (status === BOOK_STATUS.INACTIVE) filter.issuedCopies = 0;
    update.$set.status = status;
  }

  if (Object.keys(update.$set).length === 0) delete update.$set;

  const updated = await Book.findOneAndUpdate(filter, update, { new: true, runValidators: true });
  if (!updated) {
    const fresh = await Book.findById(id);
    if (!fresh) throw ApiError.notFound('Book');
    if (status === BOOK_STATUS.INACTIVE && fresh.issuedCopies > 0) {
      throw ApiError.conflict(
        'BOOK_HAS_ACTIVE_LOANS',
        `Cannot deactivate: ${fresh.issuedCopies} copy(ies) are still on loan`
      );
    }
    throw ApiError.conflict(
      'INSUFFICIENT_AVAILABLE_COPIES',
      `Cannot reduce total copies to ${totalCopies}: only ${fresh.availableCopies} of ${fresh.totalCopies} copies are on the shelf ` +
        `(${fresh.issuedCopies} issued, ${fresh.damagedCopies} damaged, ${fresh.lostCopies} lost).`
    );
  }
  return updated.populate('category', 'name status');
}

/**
 * Soft delete. The book disappears from the catalogue and cannot be issued,
 * but its transactions remain intact for history and reports.
 */
async function deactivateBook(id) {
  const updated = await Book.findOneAndUpdate(
    { _id: id, issuedCopies: 0 },
    { $set: { status: BOOK_STATUS.INACTIVE } },
    { new: true }
  );
  if (updated) return updated;
  const book = await Book.findById(id);
  if (!book) throw ApiError.notFound('Book');
  throw ApiError.conflict(
    'BOOK_HAS_ACTIVE_LOANS',
    `Cannot deactivate: ${book.issuedCopies} copy(ies) are still on loan. Wait for them to be returned or mark them lost.`
  );
}

const COPY_MOVES = {
  [COPY_ACTIONS.ADD]: { from: null, inc: { totalCopies: 1, availableCopies: 1 } },
  [COPY_ACTIONS.MARK_DAMAGED]: { from: 'availableCopies', inc: { availableCopies: -1, damagedCopies: 1 } },
  [COPY_ACTIONS.REPAIR]: { from: 'damagedCopies', inc: { damagedCopies: -1, availableCopies: 1 } },
  [COPY_ACTIONS.WRITE_OFF_DAMAGED]: { from: 'damagedCopies', inc: { damagedCopies: -1, totalCopies: -1 } },
  [COPY_ACTIONS.FOUND]: { from: 'lostCopies', inc: { lostCopies: -1, availableCopies: 1 } },
  [COPY_ACTIONS.WRITE_OFF_LOST]: { from: 'lostCopies', inc: { lostCopies: -1, totalCopies: -1 } },
};

const COPY_LABELS = {
  availableCopies: 'available',
  damagedCopies: 'damaged',
  lostCopies: 'lost',
};

/** Moves copies between inventory buckets atomically (damaged, repaired, written off, found...). */
async function adjustCopies(id, { action, quantity }) {
  const move = COPY_MOVES[action];
  const filter = { _id: id };
  if (move.from) filter[move.from] = { $gte: quantity };
  const inc = Object.fromEntries(Object.entries(move.inc).map(([field, sign]) => [field, sign * quantity]));

  const updated = await Book.findOneAndUpdate(filter, { $inc: inc }, { new: true });
  if (updated) return updated.populate('category', 'name status');

  const book = await Book.findById(id);
  if (!book) throw ApiError.notFound('Book');
  throw ApiError.conflict(
    'INSUFFICIENT_COPIES',
    `Only ${book[move.from]} ${COPY_LABELS[move.from]} copy(ies) - cannot move ${quantity}.`
  );
}

module.exports = { listBooks, getBook, createBook, updateBook, deactivateBook, adjustCopies };
