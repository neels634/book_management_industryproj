/**
 * Loads demo data: categories, ~150 copies across 38 titles, 16 members,
 * 3 logins and six months of realistic loan history (on-time and late
 * returns, paid/pending fines, a damaged return, a lost book, open and
 * overdue loans).
 *
 *   npm run seed          # refuses to run if the database already has data
 *   npm run seed:reset    # wipes ALL collections first
 */
const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const { User, Category, Book, Member, Transaction, Setting, Counter } = require('../models');
const { nextId } = require('../services/sequence.service');
const { getSettings } = require('../services/setting.service');
const { completeIsbn13 } = require('../utils/isbn');
const { addDays, endOfDay } = require('../utils/dates');
const { calculateOverdueDays, calculateOverdueFine } = require('../utils/fine');
const data = require('./data');

// Deterministic PRNG so every seed produces the same demo data.
let state = 20261008;
const random = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

async function ensureEmptyOrReset(reset) {
  const counts = await Promise.all([User, Book, Member, Transaction].map((m) => m.estimatedDocumentCount()));
  const hasData = counts.some((n) => n > 0);
  if (hasData && !reset) {
    console.error('Database already contains data. Run "npm run seed:reset" to wipe it and reseed.');
    process.exit(1);
  }
  if (reset) {
    await Promise.all(
      [User, Category, Book, Member, Transaction, Setting, Counter].map((model) => model.deleteMany({}))
    );
    console.log('Existing data removed.');
  }
}

async function seed() {
  if (!config.mongoUri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env first.');
  await connectDatabase(config.mongoUri);
  await ensureEmptyOrReset(process.argv.includes('--reset'));
  const settings = await getSettings();

  /* Categories */
  const categoryDocs = await Category.insertMany(data.categories);
  const categoryByName = Object.fromEntries(categoryDocs.map((c) => [c.name, c]));

  /* Users (admin + librarian first; member login linked below) */
  const staff = {};
  for (const u of data.users.filter((x) => x.role !== 'MEMBER')) {
    // eslint-disable-next-line no-await-in-loop
    staff[u.role] = await User.create({
      name: u.name,
      username: u.username,
      role: u.role,
      passwordHash: await User.hashPassword(u.password),
    });
  }

  /* Books - all copies start on the shelf; loan history below moves them. */
  const bookDocs = [];
  for (const [i, [title, authors, category, publisher, publishedYear, copies, price, shelf]] of data.books.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const bookId = await nextId('book');
    bookDocs.push({
      _id: new mongoose.Types.ObjectId(),
      bookId,
      title,
      authors,
      isbn: completeIsbn13(`9789${String(100000 + i * 7919).padStart(8, '0')}`.slice(0, 12)),
      category: categoryByName[category]._id,
      publisher,
      publishedYear: publishedYear >= 1000 ? publishedYear : undefined,
      language: 'English',
      price,
      shelfLocation: shelf,
      description: `${title} by ${authors.join(', ')}.`,
      totalCopies: copies,
      availableCopies: copies,
      issuedCopies: 0,
      damagedCopies: 0,
      lostCopies: 0,
      status: 'ACTIVE',
      createdBy: staff.LIBRARIAN._id,
      createdAt: addDays(new Date(), -between(200, 400)),
    });
  }
  // A few recent acquisitions for the "recently added" panel.
  bookDocs.slice(-4).forEach((b, i) => {
    b.createdAt = addDays(new Date(), -(i + 1) * 3);
  });

  /* Members */
  const memberDocs = [];
  for (const [i, [name, email, phone, membershipType, borrowingLimit, membershipStatus]] of data.members.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const memberId = await nextId('member');
    const since = addDays(new Date(), -between(200, 700));
    memberDocs.push({
      _id: new mongoose.Types.ObjectId(),
      memberId,
      name,
      email,
      phone,
      membershipType,
      borrowingLimit,
      membershipStatus,
      membershipDate: since,
      membershipExpiry: addDays(since, 365 * 3),
      address: `${between(1, 250)}, ${pick(['MG Road', 'Park Street', 'Linking Road', 'Brigade Road', 'Anna Salai'])}, ${pick(['Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Pune'])}`,
      currentBorrowedCount: 0,
      createdAt: since,
    });
    if (i === 0) memberDocs[0].notes = 'Demo member account (login: member)';
  }

  /* Loan history */
  const transactions = [];
  const openKeys = new Set();
  const now = new Date();
  const eligibleMembers = memberDocs.filter((m) => m.membershipStatus !== 'INACTIVE');

  const makeTxn = async (book, member, issueDate, outcome) => {
    const dueDate = endOfDay(addDays(issueDate, settings.loanPeriodDays));
    const txn = {
      transactionId: await nextId('transaction'),
      book: book._id,
      member: member._id,
      issuedBy: pick([staff.LIBRARIAN._id, staff.ADMIN._id]),
      issueDate,
      dueDate,
      finePerDay: settings.finePerDay,
      status: 'ISSUED',
      createdAt: issueDate,
    };

    if (outcome === 'RETURNED' || outcome === 'RETURNED_LATE' || outcome === 'DAMAGED') {
      let returnDate =
        outcome === 'RETURNED_LATE'
          ? addDays(dueDate, between(1, 9))
          : addDays(issueDate, between(2, settings.loanPeriodDays - 1));
      const latest = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      if (returnDate > latest) returnDate = latest;
      const overdueDays = calculateOverdueDays(dueDate, returnDate);
      const overdue = calculateOverdueFine(overdueDays, settings.finePerDay);
      const damage = outcome === 'DAMAGED' ? settings.damagedBookFee : 0;
      const fine = overdue + damage;
      const settled = fine > 0 && returnDate < addDays(now, -20);
      Object.assign(txn, {
        status: 'RETURNED',
        returnDate,
        returnedTo: staff.LIBRARIAN._id,
        returnCondition: outcome === 'DAMAGED' ? 'DAMAGED' : 'GOOD',
        overdueDays,
        fine,
        fineBreakdown: { overdue, damage, lost: 0 },
        fineStatus: fine > 0 ? (settled ? 'PAID' : 'PENDING') : 'NONE',
        fineAssessedAt: fine > 0 ? returnDate : null,
        fineSettledAt: settled ? addDays(returnDate, between(0, 5)) : null,
        fineSettledBy: settled ? staff.LIBRARIAN._id : null,
        updatedAt: returnDate,
      });
      if (outcome === 'DAMAGED') {
        book.availableCopies -= 1;
        book.damagedCopies += 1;
        txn.remarks = 'Water damage on cover';
      }
    } else if (outcome === 'LOST') {
      const lostReportedAt = addDays(dueDate, between(2, 10));
      const overdueDays = calculateOverdueDays(dueDate, lostReportedAt);
      const overdue = calculateOverdueFine(overdueDays, settings.finePerDay);
      Object.assign(txn, {
        status: 'LOST',
        lostReportedAt,
        returnedTo: staff.LIBRARIAN._id,
        overdueDays,
        fine: overdue + book.price,
        fineBreakdown: { overdue, damage: 0, lost: book.price },
        fineStatus: 'PENDING',
        fineAssessedAt: lostReportedAt,
        remarks: 'Member reported the book lost while travelling',
      });
      book.availableCopies -= 1;
      book.lostCopies += 1;
    } else {
      // Open loan (possibly overdue if issueDate is old enough).
      book.availableCopies -= 1;
      book.issuedCopies += 1;
      member.currentBorrowedCount += 1;
      openKeys.add(`${book._id}:${member._id}`);
    }
    transactions.push(txn);
  };

  // ~6 months of closed history.
  for (let i = 0; i < 70; i += 1) {
    const issueDate = addDays(now, -between(16, 185));
    issueDate.setHours(between(9, 18), between(0, 59));
    const roll = random();
    let outcome = 'RETURNED';
    if (roll > 0.72) outcome = 'RETURNED_LATE';
    if (i === 12 || i === 40) outcome = 'DAMAGED';
    // Popular books are borrowed more often.
    const book = random() < 0.4 ? pick(bookDocs.slice(0, 12)) : pick(bookDocs);
    // eslint-disable-next-line no-await-in-loop
    await makeTxn(book, pick(eligibleMembers), issueDate, outcome);
  }
  // One lost book.
  await makeTxn(bookDocs[16], memberDocs[4], addDays(now, -60), 'LOST');

  // Open loans: some current, some overdue. Respect limits and availability.
  const activeMembers = memberDocs.filter((m) => m.membershipStatus === 'ACTIVE');
  let open = 0;
  let guard = 0;
  while (open < 22 && guard < 500) {
    guard += 1;
    const member = pick(activeMembers);
    const book = random() < 0.5 ? pick(bookDocs.slice(0, 22)) : pick(bookDocs);
    const key = `${book._id}:${member._id}`;
    if (member.currentBorrowedCount >= member.borrowingLimit || book.availableCopies <= 0 || openKeys.has(key)) continue;
    // About a quarter of open loans are overdue (issued more than the loan period ago).
    const overdue = open % 4 === 0;
    const issueDate = addDays(now, overdue ? -between(16, 30) : -between(0, 12));
    issueDate.setHours(between(9, 18), between(0, 59));
    // eslint-disable-next-line no-await-in-loop
    await makeTxn(book, member, issueDate, 'ISSUED');
    open += 1;
  }

  // Keep the demo MEMBER's account usable: no overdue loans for member #0.
  for (const t of transactions) {
    if (t.member.equals(memberDocs[0]._id) && t.status === 'ISSUED' && t.dueDate < now) {
      t.issueDate = addDays(now, -3);
      t.dueDate = endOfDay(addDays(t.issueDate, settings.loanPeriodDays));
    }
  }

  await Book.insertMany(bookDocs);
  await Member.insertMany(memberDocs);
  await Transaction.insertMany(transactions, { timestamps: false });

  /* Member login linked to member #0 */
  const memberLogin = data.users.find((u) => u.role === 'MEMBER');
  const memberUser = await User.create({
    name: memberLogin.name,
    username: memberLogin.username,
    role: 'MEMBER',
    member: memberDocs[memberLogin.memberIndex]._id,
    passwordHash: await User.hashPassword(memberLogin.password),
  });
  await Member.updateOne({ _id: memberDocs[memberLogin.memberIndex]._id }, { user: memberUser._id });

  const totalCopies = bookDocs.reduce((sum, b) => sum + b.totalCopies, 0);
  console.log('\nSeed complete:');
  console.log(`  ${categoryDocs.length} categories, ${bookDocs.length} titles (${totalCopies} copies)`);
  console.log(`  ${memberDocs.length} members, ${transactions.length} transactions (${open} open)`);
  console.log('\nDemo logins:');
  data.users.forEach((u) => console.log(`  ${u.role.padEnd(9)} ${u.username} / ${u.password}`));
  console.log('');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
