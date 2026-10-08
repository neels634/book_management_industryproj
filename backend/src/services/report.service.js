const mongoose = require('mongoose');
const config = require('../config/env');
const { Book, Member, Transaction, Category } = require('../models');
const ApiError = require('../utils/ApiError');
const { getSettings } = require('./setting.service');
const { getMemberSummary } = require('./member.service');
const { POPULATE } = require('./transaction.service');
const { BOOK_STATUS, MEMBER_STATUS, TXN_STATUS, FINE_STATUS } = require('../utils/constants');
const { calculateOverdueDays, calculateOverdueFine, roundMoney } = require('../utils/fine');
const { startOfDay, endOfDay } = require('../utils/dates');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

function dateFilter(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = startOfDay(from);
  if (to) range.$lte = endOfDay(to);
  return range;
}

async function bookIdsInCategory(category) {
  return Book.find({ category }).distinct('_id');
}

/** Monthly issue / return counts for the last `months` months (zero-filled). */
async function monthlyActivity(months = 12) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const byMonth = (field) => [
    { $match: { [field]: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: `$${field}`, timezone: config.timezone } },
        count: { $sum: 1 },
      },
    },
  ];
  const [issues, returns] = await Promise.all([
    Transaction.aggregate(byMonth('issueDate')),
    Transaction.aggregate(byMonth('returnDate')),
  ]);
  const issueMap = new Map(issues.map((m) => [m._id, m.count]));
  const returnMap = new Map(returns.map((m) => [m._id, m.count]));

  const result = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({
      month: key,
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      issues: issueMap.get(key) || 0,
      returns: returnMap.get(key) || 0,
    });
  }
  return result;
}

async function popularBooks({ from, to, category, limit = 10 } = {}) {
  const match = {};
  const range = dateFilter(from, to);
  if (range) match.issueDate = range;
  if (category) match.book = { $in: await bookIdsInCategory(category) };

  return Transaction.aggregate([
    { $match: match },
    { $group: { _id: '$book', issueCount: { $sum: 1 }, lastIssued: { $max: '$issueDate' } } },
    { $sort: { issueCount: -1, lastIssued: -1 } },
    { $limit: limit },
    { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' },
    { $lookup: { from: 'categories', localField: 'book.category', foreignField: '_id', as: 'category' } },
    {
      $project: {
        _id: 0,
        book: '$book._id',
        bookId: '$book.bookId',
        title: '$book.title',
        authors: '$book.authors',
        category: { $ifNull: [{ $arrayElemAt: ['$category.name', 0] }, 'Uncategorised'] },
        totalCopies: '$book.totalCopies',
        availableCopies: '$book.availableCopies',
        issueCount: 1,
        lastIssued: 1,
      },
    },
  ]);
}

async function topBorrowers(limit = 5) {
  return Transaction.aggregate([
    { $group: { _id: '$member', loans: { $sum: 1 } } },
    { $sort: { loans: -1 } },
    { $limit: limit },
    { $lookup: { from: 'members', localField: '_id', foreignField: '_id', as: 'member' } },
    { $unwind: '$member' },
    {
      $project: {
        _id: 0,
        member: '$member._id',
        memberId: '$member.memberId',
        name: '$member.name',
        loans: 1,
        currentBorrowedCount: '$member.currentBorrowedCount',
      },
    },
  ]);
}

function overdueFilter() {
  return { status: TXN_STATUS.ISSUED, dueDate: { $lt: new Date() } };
}

async function fineTotals() {
  const [byStatus, overdueOpen] = await Promise.all([
    Transaction.aggregate([
      { $match: { fineStatus: { $ne: FINE_STATUS.NONE } } },
      { $group: { _id: '$fineStatus', total: { $sum: '$fine' }, count: { $sum: 1 } } },
    ]),
    Transaction.find(overdueFilter()).select('dueDate finePerDay'),
  ]);
  const get = (status) => roundMoney(byStatus.find((s) => s._id === status)?.total || 0);
  const accruing = overdueOpen.reduce(
    (sum, t) => sum + calculateOverdueFine(calculateOverdueDays(t.dueDate), t.finePerDay),
    0
  );
  return {
    pending: get(FINE_STATUS.PENDING),
    collected: get(FINE_STATUS.PAID),
    waived: get(FINE_STATUS.WAIVED),
    accruing: roundMoney(accruing),
    total: roundMoney(get(FINE_STATUS.PENDING) + get(FINE_STATUS.PAID) + get(FINE_STATUS.WAIVED)),
  };
}

async function booksByCategory(extraMatch = {}) {
  return Book.aggregate([
    { $match: { status: BOOK_STATUS.ACTIVE, ...extraMatch } },
    {
      $group: {
        _id: '$category',
        titles: { $sum: 1 },
        totalCopies: { $sum: '$totalCopies' },
        availableCopies: { $sum: '$availableCopies' },
        issuedCopies: { $sum: '$issuedCopies' },
        damagedCopies: { $sum: '$damagedCopies' },
        lostCopies: { $sum: '$lostCopies' },
      },
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    {
      $project: {
        _id: 0,
        category: '$_id',
        name: { $ifNull: [{ $arrayElemAt: ['$category.name', 0] }, 'Uncategorised'] },
        titles: 1,
        totalCopies: 1,
        availableCopies: 1,
        issuedCopies: 1,
        damagedCopies: 1,
        lostCopies: 1,
      },
    },
    { $sort: { totalCopies: -1, name: 1 } },
  ]);
}

async function dashboard() {
  const [
    inventoryAgg,
    memberCounts,
    overdueCount,
    activeLoans,
    fines,
    categories,
    monthly,
    popular,
    borrowers,
    recentIssued,
    recentReturned,
    recentBooks,
    recentOverdue,
    settings,
  ] = await Promise.all([
    Book.aggregate([
      { $match: { status: BOOK_STATUS.ACTIVE } },
      {
        $group: {
          _id: null,
          titles: { $sum: 1 },
          totalCopies: { $sum: '$totalCopies' },
          availableCopies: { $sum: '$availableCopies' },
          issuedCopies: { $sum: '$issuedCopies' },
          damagedCopies: { $sum: '$damagedCopies' },
          lostCopies: { $sum: '$lostCopies' },
        },
      },
    ]),
    Member.aggregate([{ $group: { _id: '$membershipStatus', count: { $sum: 1 } } }]),
    Transaction.countDocuments(overdueFilter()),
    Transaction.countDocuments({ status: TXN_STATUS.ISSUED }),
    fineTotals(),
    booksByCategory(),
    monthlyActivity(12),
    popularBooks({ limit: 5 }),
    topBorrowers(5),
    Transaction.find({}).populate(POPULATE).sort({ issueDate: -1 }).limit(6),
    Transaction.find({ status: TXN_STATUS.RETURNED }).populate(POPULATE).sort({ returnDate: -1 }).limit(6),
    Book.find({ status: BOOK_STATUS.ACTIVE }).populate('category', 'name').sort({ createdAt: -1 }).limit(6),
    Transaction.find(overdueFilter()).populate(POPULATE).sort({ dueDate: 1 }).limit(6),
    getSettings(),
  ]);

  const inventory = inventoryAgg[0] || {
    titles: 0,
    totalCopies: 0,
    availableCopies: 0,
    issuedCopies: 0,
    damagedCopies: 0,
    lostCopies: 0,
  };
  delete inventory._id;
  const memberCount = (status) => memberCounts.find((m) => m._id === status)?.count || 0;

  return {
    currency: settings.currency,
    totals: {
      ...inventory,
      totalBooks: inventory.totalCopies,
      availableBooks: inventory.availableCopies,
      issuedBooks: inventory.issuedCopies,
      overdueBooks: overdueCount,
      activeLoans,
      totalMembers: memberCount(MEMBER_STATUS.ACTIVE) + memberCount(MEMBER_STATUS.SUSPENDED),
      activeMembers: memberCount(MEMBER_STATUS.ACTIVE),
      suspendedMembers: memberCount(MEMBER_STATUS.SUSPENDED),
      fines,
    },
    charts: {
      booksByCategory: categories,
      monthly,
      popularBooks: popular,
      topBorrowers: borrowers,
    },
    recent: {
      issued: recentIssued,
      returned: recentReturned,
      addedBooks: recentBooks,
      overdue: recentOverdue,
    },
  };
}

async function overdueReport({ category, member, limit = 500 } = {}) {
  const filter = overdueFilter();
  if (member) filter.member = member;
  if (category) filter.book = { $in: await bookIdsInCategory(category) };
  const items = await Transaction.find(filter).populate(POPULATE).sort({ dueDate: 1 }).limit(limit);
  const totalAccruedFine = roundMoney(items.reduce((sum, t) => sum + t.accruedFine, 0));
  return { items, summary: { count: items.length, totalAccruedFine } };
}

const BOOK_REPORT_FILTERS = {
  all: { status: BOOK_STATUS.ACTIVE },
  available: { status: BOOK_STATUS.ACTIVE, availableCopies: { $gt: 0 } },
  unavailable: { status: BOOK_STATUS.ACTIVE, availableCopies: 0 },
  issued: { issuedCopies: { $gt: 0 } },
  damaged: { damagedCopies: { $gt: 0 } },
  lost: { lostCopies: { $gt: 0 } },
  inactive: { status: BOOK_STATUS.INACTIVE },
};

async function booksReport({ status = 'all', category, limit = 1000 } = {}) {
  const filter = { ...BOOK_REPORT_FILTERS[status] };
  if (category) filter.category = toObjectId(category);
  const [items, totals] = await Promise.all([
    Book.find(filter).populate('category', 'name').sort({ title: 1 }).limit(limit).collation({ locale: 'en' }),
    Book.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          titles: { $sum: 1 },
          totalCopies: { $sum: '$totalCopies' },
          availableCopies: { $sum: '$availableCopies' },
          issuedCopies: { $sum: '$issuedCopies' },
          damagedCopies: { $sum: '$damagedCopies' },
          lostCopies: { $sum: '$lostCopies' },
        },
      },
    ]),
  ]);
  const summary = totals[0] || { titles: 0, totalCopies: 0, availableCopies: 0, issuedCopies: 0, damagedCopies: 0, lostCopies: 0 };
  delete summary._id;
  return { items, summary };
}

async function categoryStats({ from, to } = {}) {
  const range = dateFilter(from, to);
  const [inventory, categories, loans] = await Promise.all([
    booksByCategory(),
    Category.find({}).sort({ name: 1 }),
    Transaction.aggregate([
      ...(range ? [{ $match: { issueDate: range } }] : []),
      { $lookup: { from: 'books', localField: 'book', foreignField: '_id', as: 'b' } },
      { $unwind: '$b' },
      { $group: { _id: '$b.category', issues: { $sum: 1 }, fines: { $sum: '$fine' } } },
    ]),
  ]);
  const invMap = new Map(inventory.map((i) => [i.category.toString(), i]));
  const loanMap = new Map(loans.map((l) => [l._id.toString(), l]));
  return categories.map((c) => {
    const inv = invMap.get(c._id.toString()) || {};
    const loan = loanMap.get(c._id.toString()) || {};
    return {
      category: c._id,
      name: c.name,
      status: c.status,
      titles: inv.titles || 0,
      totalCopies: inv.totalCopies || 0,
      availableCopies: inv.availableCopies || 0,
      issuedCopies: inv.issuedCopies || 0,
      issues: loan.issues || 0,
      fines: roundMoney(loan.fines || 0),
    };
  });
}

/** Fines assessed in the period, with totals per status. */
async function finesReport({ from, to, fineStatus, member, category, limit = 1000 } = {}) {
  const filter = { fineStatus: fineStatus || { $ne: FINE_STATUS.NONE } };
  const range = dateFilter(from, to);
  if (range) filter.fineAssessedAt = range;
  if (member) filter.member = toObjectId(member);
  if (category) filter.book = { $in: await bookIdsInCategory(category) };

  const [items, totals] = await Promise.all([
    Transaction.find(filter).populate(POPULATE).sort({ fineAssessedAt: -1 }).limit(limit),
    Transaction.aggregate([
      { $match: filter },
      { $group: { _id: '$fineStatus', total: { $sum: '$fine' }, count: { $sum: 1 } } },
    ]),
  ]);
  const get = (status) => totals.find((t) => t._id === status) || { total: 0, count: 0 };
  return {
    items,
    summary: {
      pending: roundMoney(get(FINE_STATUS.PENDING).total),
      collected: roundMoney(get(FINE_STATUS.PAID).total),
      waived: roundMoney(get(FINE_STATUS.WAIVED).total),
      count: items.length,
    },
  };
}

async function memberHistory({ member, from, to, status }) {
  const memberDoc = await Member.findById(member);
  if (!memberDoc) throw ApiError.notFound('Member');
  const filter = { member: memberDoc._id };
  const range = dateFilter(from, to);
  if (range) filter.issueDate = range;
  if (status === TXN_STATUS.OVERDUE) Object.assign(filter, overdueFilter());
  else if (status) filter.status = status;

  const [items, summary] = await Promise.all([
    Transaction.find(filter).populate(POPULATE).sort({ issueDate: -1 }),
    getMemberSummary(memberDoc._id),
  ]);
  return { member: memberDoc, items, stats: summary.stats };
}

module.exports = {
  dashboard,
  overdueReport,
  popularBooks,
  booksReport,
  categoryStats,
  finesReport,
  memberHistory,
  monthlyActivity,
};
