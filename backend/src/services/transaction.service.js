const { Transaction, Book, Member } = require('../models');
const ApiError = require('../utils/ApiError');
const { nextId } = require('./sequence.service');
const { getSettings } = require('./setting.service');
const { runInTransaction } = require('./unitOfWork');
const { calculateOverdueDays, calculateOverdueFine, roundMoney } = require('../utils/fine');
const { endOfDay, startOfDay, addDays } = require('../utils/dates');
const { containsRegex, paginationFrom, sortFrom } = require('../utils/query');
const {
  BOOK_STATUS,
  MEMBER_STATUS,
  TXN_STATUS,
  FINE_STATUS,
  RETURN_CONDITION,
  ROLES,
} = require('../utils/constants');

const POPULATE = [
  { path: 'book', select: 'bookId title isbn authors status price' },
  { path: 'member', select: 'memberId name phone email membershipStatus' },
  { path: 'issuedBy', select: 'name username' },
  { path: 'returnedTo', select: 'name username' },
  { path: 'fineSettledBy', select: 'name username' },
];

// Allow a little clock skew between browser and server for "now" timestamps.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const isDuplicateLoanError = (err) => err?.code === 11000 && String(err.message).includes('one_open_loan_per_title');

/* ----------------------------------------------------------------- queries */

async function buildListFilter(query, user) {
  const filter = {};

  if (user.role === ROLES.MEMBER) {
    // Members can only ever see their own loans.
    if (!user.member) return null;
    filter.member = user.member;
  } else if (query.member) {
    filter.member = query.member;
  }
  if (query.book) filter.book = query.book;

  if (query.status === TXN_STATUS.OVERDUE) {
    filter.status = TXN_STATUS.ISSUED;
    filter.dueDate = { $lt: new Date() };
  } else if (query.status) {
    filter.status = query.status;
  }
  if (query.fineStatus) filter.fineStatus = query.fineStatus;
  if (query.from || query.to) {
    filter.issueDate = {};
    if (query.from) filter.issueDate.$gte = startOfDay(query.from);
    if (query.to) filter.issueDate.$lte = endOfDay(query.to);
  }

  if (query.q) {
    const rx = containsRegex(query.q);
    const [bookIds, memberIds] = await Promise.all([
      Book.find({ $or: [{ title: rx }, { bookId: rx }, { isbn: rx }] }).distinct('_id'),
      user.role === ROLES.MEMBER ? [] : Member.find({ $or: [{ name: rx }, { memberId: rx }] }).distinct('_id'),
    ]);
    filter.$or = [{ transactionId: rx }, { book: { $in: bookIds } }, { member: { $in: memberIds } }];
  }
  return filter;
}

async function listTransactions(query, user) {
  const { page, limit, skip } = paginationFrom(query);
  const filter = await buildListFilter(query, user);
  if (!filter) return { items: [], total: 0, page, limit };

  const sort = sortFrom(
    { sortBy: query.sortBy || 'issueDate', order: query.order || 'desc' },
    ['issueDate', 'dueDate', 'returnDate', 'fine', 'createdAt'],
    'issueDate'
  );
  const [items, total] = await Promise.all([
    Transaction.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function getTransaction(id, user) {
  const txn = await Transaction.findById(id).populate(POPULATE);
  if (!txn) throw ApiError.notFound('Transaction');
  if (user.role === ROLES.MEMBER && txn.member?._id.toString() !== user.member) {
    // Do not reveal that someone else's transaction exists.
    throw ApiError.notFound('Transaction');
  }
  return txn;
}

/* --------------------------------------------------------------- issuing */

function resolveDueDate(requested, issueDate, settings) {
  if (!requested) return endOfDay(addDays(issueDate, settings.loanPeriodDays));
  const due = endOfDay(requested);
  if (due < endOfDay(issueDate)) {
    throw ApiError.badRequest('Due date cannot be before the issue date', 'INVALID_DUE_DATE');
  }
  const latest = endOfDay(addDays(issueDate, settings.maxLoanPeriodDays));
  if (due > latest) {
    throw ApiError.badRequest(
      `Due date cannot be more than ${settings.maxLoanPeriodDays} days after the issue date`,
      'INVALID_DUE_DATE'
    );
  }
  return due;
}

/** Business-rule checks that give the librarian a precise reason for a refusal. */
async function assertMemberCanBorrow(member, bookId, settings, session) {
  if (member.membershipStatus !== MEMBER_STATUS.ACTIVE) {
    throw ApiError.conflict(
      'MEMBER_NOT_ACTIVE',
      `Member ${member.memberId} is ${member.membershipStatus.toLowerCase()} and cannot borrow books`
    );
  }
  if (member.membershipExpiry && member.membershipExpiry < new Date()) {
    throw ApiError.conflict('MEMBERSHIP_EXPIRED', `Membership of ${member.memberId} expired - renew it before issuing`);
  }
  if (member.currentBorrowedCount >= member.borrowingLimit) {
    throw ApiError.conflict(
      'BORROWING_LIMIT_REACHED',
      `${member.name} already has ${member.currentBorrowedCount} of ${member.borrowingLimit} allowed books`
    );
  }

  const [openLoans, pendingFines] = await Promise.all([
    Transaction.find({ member: member._id, status: TXN_STATUS.ISSUED }).select('book dueDate').session(session),
    Transaction.aggregate([
      { $match: { member: member._id, fineStatus: FINE_STATUS.PENDING } },
      { $group: { _id: null, total: { $sum: '$fine' } } },
    ]).session(session),
  ]);

  if (openLoans.some((loan) => loan.book.toString() === bookId.toString())) {
    throw ApiError.conflict('DUPLICATE_LOAN', 'This member already has a copy of this book on loan');
  }
  const now = new Date();
  if (settings.blockBorrowingWhenOverdue && openLoans.some((loan) => loan.dueDate < now)) {
    throw ApiError.conflict('MEMBER_HAS_OVERDUE', 'Member has overdue books - they must be returned first');
  }
  const owed = pendingFines[0]?.total || 0;
  if (owed > settings.maxOutstandingFine) {
    throw ApiError.conflict(
      'OUTSTANDING_FINES',
      `Unpaid fines of ${settings.currency} ${roundMoney(owed)} exceed the limit of ${settings.currency} ${settings.maxOutstandingFine}`
    );
  }
}

/**
 * Issue flow (all-or-nothing):
 *  1-3. member exists, is active, is under the borrowing limit (+ fines/overdue rules)
 *  4-5. book exists, is active, has availableCopies > 0
 *  6.   create the transaction
 *  7-9. availableCopies -1, issuedCopies +1, member.currentBorrowedCount +1
 *
 * Steps 7-9 are conditional atomic updates ({availableCopies: {$gt: 0}},
 * {$expr: count < limit}), so two librarians issuing the last copy at the same
 * moment cannot both succeed - one gets NO_COPIES_AVAILABLE.
 */
async function issueBook({ book: bookId, member: memberId, dueDate, remarks }, actor) {
  const settings = await getSettings();
  const issueDate = new Date();
  const due = resolveDueDate(dueDate, issueDate, settings);
  const transactionId = await nextId('transaction');

  try {
    const txnId = await runInTransaction(async ({ session, onRollback }) => {
      const member = await Member.findById(memberId).session(session);
      if (!member) throw ApiError.notFound('Member');
      const book = await Book.findById(bookId).session(session);
      if (!book) throw ApiError.notFound('Book');
      if (book.status !== BOOK_STATUS.ACTIVE) {
        throw ApiError.conflict('BOOK_INACTIVE', `"${book.title}" has been withdrawn from circulation`);
      }

      await assertMemberCanBorrow(member, book._id, settings, session);

      if (book.availableCopies <= 0) {
        throw ApiError.conflict('NO_COPIES_AVAILABLE', `No copies of "${book.title}" are available right now`);
      }

      const memberUpdated = await Member.findOneAndUpdate(
        {
          _id: member._id,
          membershipStatus: MEMBER_STATUS.ACTIVE,
          $expr: { $lt: ['$currentBorrowedCount', '$borrowingLimit'] },
        },
        { $inc: { currentBorrowedCount: 1 } },
        { new: true, session }
      );
      if (!memberUpdated) {
        throw ApiError.conflict('BORROWING_LIMIT_REACHED', `${member.name} has reached the borrowing limit`);
      }
      onRollback(() => Member.updateOne({ _id: member._id }, { $inc: { currentBorrowedCount: -1 } }));

      const bookUpdated = await Book.findOneAndUpdate(
        { _id: book._id, status: BOOK_STATUS.ACTIVE, availableCopies: { $gt: 0 } },
        { $inc: { availableCopies: -1, issuedCopies: 1 } },
        { new: true, session }
      );
      if (!bookUpdated) {
        throw ApiError.conflict('NO_COPIES_AVAILABLE', `No copies of "${book.title}" are available right now`);
      }
      onRollback(() => Book.updateOne({ _id: book._id }, { $inc: { availableCopies: 1, issuedCopies: -1 } }));

      const [created] = await Transaction.create(
        [
          {
            transactionId,
            book: book._id,
            member: member._id,
            issuedBy: actor.id,
            issueDate,
            dueDate: due,
            status: TXN_STATUS.ISSUED,
            finePerDay: settings.finePerDay,
            remarks: remarks || '',
          },
        ],
        { session }
      );
      return created._id;
    });
    return Transaction.findById(txnId).populate(POPULATE);
  } catch (err) {
    if (isDuplicateLoanError(err)) {
      throw ApiError.conflict('DUPLICATE_LOAN', 'This member already has a copy of this book on loan');
    }
    throw err;
  }
}

/* -------------------------------------------------------------- returning */

function resolveReturnDate(requested, txn) {
  const now = new Date();
  if (!requested) return now;
  if (requested.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    throw ApiError.badRequest('Return date cannot be in the future', 'INVALID_RETURN_DATE');
  }
  if (requested < startOfDay(txn.issueDate)) {
    throw ApiError.badRequest('Return date cannot be before the issue date', 'INVALID_RETURN_DATE');
  }
  // A date-only value on the issue day means "returned the same day".
  return requested < txn.issueDate ? txn.issueDate : requested;
}

async function findOpenLoan({ transaction, book, member }, session) {
  const filter = { status: TXN_STATUS.ISSUED };
  if (transaction) filter._id = transaction;
  else Object.assign(filter, { book, member });
  const txn = await Transaction.findOne(filter).session(session);
  if (txn) return txn;

  if (transaction) {
    const closed = await Transaction.findById(transaction).select('status transactionId').session(session);
    if (closed) {
      throw ApiError.conflict(
        'TRANSACTION_CLOSED',
        `Transaction ${closed.transactionId} is already ${closed.status.toLowerCase()}`
      );
    }
  }
  throw ApiError.notFound('Active loan', 'ACTIVE_LOAN_NOT_FOUND');
}

/**
 * Return flow (all-or-nothing):
 *  1. find the open loan     2. set returnDate      3. overdue days
 *  4. fine (overdue x rate, + damage fee)            5. status RETURNED
 *  6-8. availableCopies +1 (or damagedCopies +1), issuedCopies -1,
 *       member.currentBorrowedCount -1
 */
async function returnBook({ transaction, book, member, returnDate, condition, remarks }, actor) {
  const settings = await getSettings();

  const txnId = await runInTransaction(async ({ session, onRollback }) => {
    const txn = await findOpenLoan({ transaction, book, member }, session);
    const returnedAt = resolveReturnDate(returnDate, txn);
    const overdueDays = calculateOverdueDays(txn.dueDate, returnedAt);
    const overdueFine = calculateOverdueFine(overdueDays, txn.finePerDay);
    const damageFine = condition === RETURN_CONDITION.DAMAGED ? settings.damagedBookFee : 0;
    const fine = roundMoney(overdueFine + damageFine);

    const closed = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: TXN_STATUS.ISSUED },
      {
        $set: {
          status: TXN_STATUS.RETURNED,
          returnDate: returnedAt,
          returnedTo: actor.id,
          returnCondition: condition,
          overdueDays,
          fine,
          fineBreakdown: { overdue: overdueFine, damage: damageFine, lost: 0 },
          fineStatus: fine > 0 ? FINE_STATUS.PENDING : FINE_STATUS.NONE,
          fineAssessedAt: fine > 0 ? new Date() : null,
          remarks: remarks ? [txn.remarks, remarks].filter(Boolean).join(' | ') : txn.remarks,
        },
      },
      { new: true, session }
    );
    // Someone else returned it a moment ago.
    if (!closed) throw ApiError.conflict('TRANSACTION_CLOSED', `Transaction ${txn.transactionId} is already closed`);
    onRollback(() =>
      Transaction.updateOne(
        { _id: txn._id },
        {
          $set: {
            status: TXN_STATUS.ISSUED,
            returnDate: null,
            returnedTo: null,
            returnCondition: null,
            overdueDays: 0,
            fine: 0,
            fineStatus: FINE_STATUS.NONE,
            fineAssessedAt: null,
            remarks: txn.remarks,
          },
        }
      )
    );

    const shelf = condition === RETURN_CONDITION.DAMAGED ? 'damagedCopies' : 'availableCopies';
    const bookUpdated = await Book.updateOne(
      { _id: txn.book, issuedCopies: { $gt: 0 } },
      { $inc: { issuedCopies: -1, [shelf]: 1 } },
      { session }
    );
    if (bookUpdated.modifiedCount !== 1) throw new Error(`Inventory inconsistency: book ${txn.book} has no issued copies`);
    onRollback(() => Book.updateOne({ _id: txn.book }, { $inc: { issuedCopies: 1, [shelf]: -1 } }));

    const memberUpdated = await Member.updateOne(
      { _id: txn.member, currentBorrowedCount: { $gt: 0 } },
      { $inc: { currentBorrowedCount: -1 } },
      { session }
    );
    if (memberUpdated.modifiedCount !== 1) {
      throw new Error(`Inventory inconsistency: member ${txn.member} has no borrowed books`);
    }
    onRollback(() => Member.updateOne({ _id: txn.member }, { $inc: { currentBorrowedCount: 1 } }));

    return txn._id;
  });
  return Transaction.findById(txnId).populate(POPULATE);
}

/* ------------------------------------------------------- renew / lost / fine */

async function renewLoan(id, { remarks }) {
  const settings = await getSettings();
  const txn = await Transaction.findById(id);
  if (!txn) throw ApiError.notFound('Transaction');
  if (txn.status !== TXN_STATUS.ISSUED) {
    throw ApiError.conflict('TRANSACTION_CLOSED', `Transaction ${txn.transactionId} is already ${txn.status.toLowerCase()}`);
  }
  if (txn.isOverdue) {
    throw ApiError.conflict('LOAN_OVERDUE', 'Overdue loans cannot be renewed - return the book and settle the fine');
  }
  if (txn.renewCount >= settings.maxRenewals) {
    throw ApiError.conflict('RENEWAL_LIMIT_REACHED', `This loan has already been renewed ${txn.renewCount} time(s)`);
  }
  const member = await Member.findById(txn.member).select('membershipStatus');
  if (member?.membershipStatus !== MEMBER_STATUS.ACTIVE) {
    throw ApiError.conflict('MEMBER_NOT_ACTIVE', 'Only active members can renew loans');
  }

  const newDue = endOfDay(addDays(txn.dueDate, settings.loanPeriodDays));
  const updated = await Transaction.findOneAndUpdate(
    { _id: id, status: TXN_STATUS.ISSUED, renewCount: txn.renewCount, dueDate: { $gte: new Date() } },
    {
      $set: {
        dueDate: newDue,
        remarks: remarks ? [txn.remarks, remarks].filter(Boolean).join(' | ') : txn.remarks,
      },
      $inc: { renewCount: 1 },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('CONCURRENT_UPDATE', 'Loan changed while renewing - please refresh and retry');
  return updated.populate(POPULATE);
}

/**
 * Lost book: closes the loan, moves the copy from "issued" to "lost" and
 * charges replacement cost (book price, or the configured lost-book fee) plus
 * any overdue fine accrued so far.
 */
async function markLost(id, { remarks }, actor) {
  const settings = await getSettings();

  await runInTransaction(async ({ session, onRollback }) => {
    const txn = await Transaction.findById(id).session(session);
    if (!txn) throw ApiError.notFound('Transaction');
    if (txn.status !== TXN_STATUS.ISSUED) {
      throw ApiError.conflict('TRANSACTION_CLOSED', `Transaction ${txn.transactionId} is already ${txn.status.toLowerCase()}`);
    }
    const book = await Book.findById(txn.book).select('price').session(session);
    const now = new Date();
    const overdueDays = calculateOverdueDays(txn.dueDate, now);
    const overdueFine = calculateOverdueFine(overdueDays, txn.finePerDay);
    const lostFee = book?.price > 0 ? book.price : settings.lostBookFee;
    const fine = roundMoney(overdueFine + lostFee);

    const closed = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: TXN_STATUS.ISSUED },
      {
        $set: {
          status: TXN_STATUS.LOST,
          lostReportedAt: now,
          returnedTo: actor.id,
          overdueDays,
          fine,
          fineBreakdown: { overdue: overdueFine, damage: 0, lost: lostFee },
          fineStatus: fine > 0 ? FINE_STATUS.PENDING : FINE_STATUS.NONE,
          fineAssessedAt: now,
          remarks: remarks ? [txn.remarks, remarks].filter(Boolean).join(' | ') : txn.remarks,
        },
      },
      { new: true, session }
    );
    if (!closed) throw ApiError.conflict('TRANSACTION_CLOSED', `Transaction ${txn.transactionId} is already closed`);
    onRollback(() =>
      Transaction.updateOne(
        { _id: txn._id },
        {
          $set: {
            status: TXN_STATUS.ISSUED,
            lostReportedAt: null,
            returnedTo: null,
            overdueDays: 0,
            fine: 0,
            fineStatus: FINE_STATUS.NONE,
            fineAssessedAt: null,
            remarks: txn.remarks,
          },
        }
      )
    );

    const bookUpdated = await Book.updateOne(
      { _id: txn.book, issuedCopies: { $gt: 0 } },
      { $inc: { issuedCopies: -1, lostCopies: 1 } },
      { session }
    );
    if (bookUpdated.modifiedCount !== 1) throw new Error(`Inventory inconsistency: book ${txn.book} has no issued copies`);
    onRollback(() => Book.updateOne({ _id: txn.book }, { $inc: { issuedCopies: 1, lostCopies: -1 } }));

    const memberUpdated = await Member.updateOne(
      { _id: txn.member, currentBorrowedCount: { $gt: 0 } },
      { $inc: { currentBorrowedCount: -1 } },
      { session }
    );
    if (memberUpdated.modifiedCount !== 1) {
      throw new Error(`Inventory inconsistency: member ${txn.member} has no borrowed books`);
    }
    onRollback(() => Member.updateOne({ _id: txn.member }, { $inc: { currentBorrowedCount: 1 } }));
  });

  return Transaction.findById(id).populate(POPULATE);
}

/** Records payment of a fine, or waives it (ADMIN only). */
async function settleFine(id, { action, remarks }, actor) {
  if (action === 'WAIVE' && actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only an administrator can waive fines');
  }
  const txn = await Transaction.findById(id);
  if (!txn) throw ApiError.notFound('Transaction');
  if (txn.fineStatus !== FINE_STATUS.PENDING) {
    throw ApiError.conflict('NO_PENDING_FINE', 'This transaction has no pending fine');
  }
  const updated = await Transaction.findOneAndUpdate(
    { _id: id, fineStatus: FINE_STATUS.PENDING },
    {
      $set: {
        fineStatus: action === 'PAY' ? FINE_STATUS.PAID : FINE_STATUS.WAIVED,
        fineSettledAt: new Date(),
        fineSettledBy: actor.id,
        remarks: remarks ? [txn.remarks, remarks].filter(Boolean).join(' | ') : txn.remarks,
      },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('NO_PENDING_FINE', 'This fine was already settled');
  return updated.populate(POPULATE);
}

module.exports = {
  listTransactions,
  getTransaction,
  issueBook,
  returnBook,
  renewLoan,
  markLost,
  settleFine,
  POPULATE,
};
