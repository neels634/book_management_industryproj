const { Member, User, Transaction } = require('../models');
const ApiError = require('../utils/ApiError');
const { nextId } = require('./sequence.service');
const { getSettings } = require('./setting.service');
const { runInTransaction } = require('./unitOfWork');
const { MEMBER_STATUS, ROLES, TXN_STATUS, FINE_STATUS, USER_STATUS } = require('../utils/constants');
const { containsRegex, paginationFrom, sortFrom } = require('../utils/query');
const { calculateOverdueDays, calculateOverdueFine, roundMoney } = require('../utils/fine');

const LIST_SORT_FIELDS = ['name', 'memberId', 'membershipDate', 'currentBorrowedCount', 'createdAt'];

async function listMembers(query) {
  const { page, limit, skip } = paginationFrom(query);
  const filter = {};
  if (query.status) filter.membershipStatus = query.status;
  if (query.membershipType) filter.membershipType = query.membershipType;
  if (query.hasLoans === 'true') filter.currentBorrowedCount = { $gt: 0 };
  if (query.hasLoans === 'false') filter.currentBorrowedCount = 0;
  if (query.q) {
    const rx = containsRegex(query.q);
    filter.$or = [{ name: rx }, { memberId: rx }, { email: rx }, { phone: rx }];
  }
  const sort = sortFrom(query, LIST_SORT_FIELDS, 'name');
  const [items, total] = await Promise.all([
    Member.find(filter).sort(sort).skip(skip).limit(limit).collation({ locale: 'en' }),
    Member.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

/** Borrowing summary used on the member profile and by the issue screen. */
async function getMemberSummary(memberId) {
  const [activeLoans, totals] = await Promise.all([
    Transaction.find({ member: memberId, status: TXN_STATUS.ISSUED })
      .populate('book', 'bookId title isbn authors price')
      .sort({ dueDate: 1 }),
    Transaction.aggregate([
      { $match: { member: memberId } },
      {
        $group: {
          _id: null,
          totalLoans: { $sum: 1 },
          pendingFines: { $sum: { $cond: [{ $eq: ['$fineStatus', FINE_STATUS.PENDING] }, '$fine', 0] } },
          paidFines: { $sum: { $cond: [{ $eq: ['$fineStatus', FINE_STATUS.PAID] }, '$fine', 0] } },
          lostBooks: { $sum: { $cond: [{ $eq: ['$status', TXN_STATUS.LOST] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const overdueLoans = activeLoans.filter((t) => t.isOverdue);
  const accruingFines = overdueLoans.reduce(
    (sum, t) => sum + calculateOverdueFine(calculateOverdueDays(t.dueDate), t.finePerDay),
    0
  );
  const t = totals[0] || { totalLoans: 0, pendingFines: 0, paidFines: 0, lostBooks: 0 };
  return {
    activeLoans,
    stats: {
      totalLoans: t.totalLoans,
      activeLoans: activeLoans.length,
      overdueLoans: overdueLoans.length,
      lostBooks: t.lostBooks,
      pendingFines: roundMoney(t.pendingFines),
      paidFines: roundMoney(t.paidFines),
      accruingFines: roundMoney(accruingFines),
    },
  };
}

async function getMember(id) {
  const member = await Member.findById(id).populate('user', 'username status lastLoginAt');
  if (!member) throw ApiError.notFound('Member');
  const summary = await getMemberSummary(member._id);
  return { ...member.toJSON(), ...summary };
}

async function createMember(data) {
  const settings = await getSettings();
  const { login, ...fields } = data;
  if (login && (await User.exists({ username: login.username }))) {
    throw ApiError.conflict('DUPLICATE_USERNAME', 'This username is already taken');
  }
  const memberId = await nextId('member');

  return runInTransaction(async ({ session, onRollback }) => {
    const member = new Member({
      ...fields,
      memberId,
      borrowingLimit: fields.borrowingLimit ?? settings.defaultBorrowingLimit,
      currentBorrowedCount: 0,
      membershipStatus: MEMBER_STATUS.ACTIVE,
    });

    if (login) {
      const user = new User({
        name: fields.name,
        username: login.username,
        passwordHash: await User.hashPassword(login.password),
        role: ROLES.MEMBER,
        member: member._id,
      });
      await user.save({ session });
      onRollback(() => User.deleteOne({ _id: user._id }));
      member.user = user._id;
    }

    await member.save({ session });
    return member;
  });
}

const USER_STATUS_FOR_MEMBER = {
  [MEMBER_STATUS.ACTIVE]: USER_STATUS.ACTIVE,
  // Suspended members can still log in to see their fines and loans.
  [MEMBER_STATUS.SUSPENDED]: USER_STATUS.ACTIVE,
  [MEMBER_STATUS.INACTIVE]: USER_STATUS.INACTIVE,
};

async function updateMember(id, changes) {
  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member');

  const update = { ...changes };
  if (update.membershipExpiry === '') update.membershipExpiry = null;
  const expiry = update.membershipExpiry !== undefined ? update.membershipExpiry : member.membershipExpiry;
  const since = update.membershipDate || member.membershipDate;
  if (expiry && since && expiry <= since) {
    throw ApiError.validation([{ field: 'membershipExpiry', message: 'Membership expiry must be after the membership date' }]);
  }

  const filter = { _id: id };
  const closing =
    update.membershipStatus === MEMBER_STATUS.INACTIVE && member.membershipStatus !== MEMBER_STATUS.INACTIVE;
  if (closing) filter.currentBorrowedCount = 0;

  const updated = await Member.findOneAndUpdate(filter, { $set: update }, { new: true, runValidators: true });
  if (!updated) {
    throw ApiError.conflict(
      'MEMBER_HAS_ACTIVE_LOANS',
      'This member still has books on loan. They must be returned (or marked lost) before the membership is closed.'
    );
  }

  if (update.membershipStatus && updated.user) {
    await User.updateOne(
      { _id: updated.user },
      {
        $set: { status: USER_STATUS_FOR_MEMBER[update.membershipStatus] },
        ...(closing ? { $inc: { tokenVersion: 1 } } : {}),
      }
    );
  }
  return updated;
}

/** Soft delete - membership closed, borrowing history kept. */
async function deactivateMember(id) {
  return updateMember(id, { membershipStatus: MEMBER_STATUS.INACTIVE });
}

module.exports = { listMembers, getMember, getMemberSummary, createMember, updateMember, deactivateMember };
