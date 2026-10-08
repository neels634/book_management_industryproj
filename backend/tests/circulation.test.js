/**
 * Issue / return business logic, including the real-world scenarios from the
 * requirements (Stage 3). Every test checks that inventory counters and the
 * member's borrowed count stay consistent with the transaction records.
 */
const { api, useTestDatabase, actor, createBook, createMember } = require('./helpers/setup');
const { Book, Member, Transaction, Setting } = require('../src/models');
const { addDays, endOfDay } = require('../src/utils/dates');

useTestDatabase();

let librarian;
beforeEach(async () => {
  librarian = await actor('LIBRARIAN');
});

const issue = (book, member, extra = {}) =>
  api()
    .post('/api/transactions/issue')
    .set('Authorization', librarian.auth)
    .send({ book: book._id.toString(), member: member._id.toString(), ...extra });

const giveBack = (body) => api().post('/api/transactions/return').set('Authorization', librarian.auth).send(body);

async function expectConsistent(bookId, memberId) {
  const book = await Book.findById(bookId);
  const open = await Transaction.countDocuments({ book: bookId, status: 'ISSUED' });
  const lost = await Transaction.countDocuments({ book: bookId, status: 'LOST' });
  expect(book.issuedCopies).toBe(open);
  expect(book.lostCopies).toBe(lost);
  expect(book.availableCopies + book.issuedCopies + book.damagedCopies + book.lostCopies).toBe(book.totalCopies);
  expect(book.availableCopies).toBeGreaterThanOrEqual(0);
  if (memberId) {
    const member = await Member.findById(memberId);
    expect(member.currentBorrowedCount).toBe(await Transaction.countDocuments({ member: memberId, status: 'ISSUED' }));
  }
}

/** Moves an open loan into the past so it is overdue by `days` days. */
async function backdate(txnId, { issuedDaysAgo, dueDaysAgo }) {
  await Transaction.updateOne(
    { _id: txnId },
    { issueDate: addDays(new Date(), -issuedDaysAgo), dueDate: endOfDay(addDays(new Date(), -dueDaysAgo)) }
  );
}

describe('Issuing books', () => {
  it('Scenario 2: a member borrows a book', async () => {
    const book = await createBook({ totalCopies: 3 });
    const member = await createMember();
    const res = await issue(book, member);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'ISSUED', displayStatus: 'ISSUED', finePerDay: 5, isOverdue: false });
    expect(res.body.data.transactionId).toMatch(/^TXN-\d{6}$/);
    // Default loan period: 14 days, due at the end of that day.
    const due = new Date(res.body.data.dueDate);
    expect(due.getTime()).toBe(endOfDay(addDays(new Date(), 14)).getTime());

    expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 2, issuedCopies: 1 });
    expect((await Member.findById(member._id)).currentBorrowedCount).toBe(1);
    await expectConsistent(book._id, member._id);
  });

  it('Scenario 3: multiple members borrow copies of the same book', async () => {
    const book = await createBook({ totalCopies: 3 });
    const members = await Promise.all([1, 2, 3].map((i) => createMember({ name: `Member ${i}` })));
    for (const m of members) {
      // eslint-disable-next-line no-await-in-loop
      expect((await issue(book, m)).status).toBe(201);
    }
    expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 0, issuedCopies: 3 });
    await expectConsistent(book._id);
  });

  it('Scenario 4: no copies available - another member is refused', async () => {
    const book = await createBook({ totalCopies: 1 });
    await issue(book, await createMember());
    const res = await issue(book, await createMember());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_COPIES_AVAILABLE');
    expect(await Transaction.countDocuments()).toBe(1);
    await expectConsistent(book._id);
  });

  it('Scenario 8: a member cannot exceed the borrowing limit', async () => {
    const member = await createMember({ borrowingLimit: 2 });
    const books = await Promise.all([1, 2, 3].map(() => createBook()));
    expect((await issue(books[0], member)).status).toBe(201);
    expect((await issue(books[1], member)).status).toBe(201);
    const res = await issue(books[2], member);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BORROWING_LIMIT_REACHED');
    expect((await Member.findById(member._id)).currentBorrowedCount).toBe(2);
    expect(await Book.findById(books[2]._id)).toMatchObject({ availableCopies: 3, issuedCopies: 0 });
  });

  it('refuses a second copy of the same title to the same member', async () => {
    const book = await createBook({ totalCopies: 5 });
    const member = await createMember();
    await issue(book, member);
    const res = await issue(book, member);
    expect(res.body.error.code).toBe('DUPLICATE_LOAN');
    await expectConsistent(book._id, member._id);
  });

  it.each([
    ['SUSPENDED', 'MEMBER_NOT_ACTIVE'],
    ['INACTIVE', 'MEMBER_NOT_ACTIVE'],
  ])('refuses %s members', async (membershipStatus, code) => {
    const res = await issue(await createBook(), await createMember({ membershipStatus }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(code);
  });

  it('refuses members whose membership has expired', async () => {
    const member = await createMember({ membershipDate: addDays(new Date(), -400), membershipExpiry: addDays(new Date(), -1) });
    expect((await issue(await createBook(), member)).body.error.code).toBe('MEMBERSHIP_EXPIRED');
  });

  it('refuses inactive (withdrawn) books', async () => {
    const res = await issue(await createBook({ status: 'INACTIVE' }), await createMember());
    expect(res.body.error.code).toBe('BOOK_INACTIVE');
  });

  it('refuses members with overdue books or unpaid fines over the limit', async () => {
    const member = await createMember({ borrowingLimit: 5 });
    const first = await issue(await createBook(), member);
    await backdate(first.body.data._id, { issuedDaysAgo: 20, dueDaysAgo: 3 });
    expect((await issue(await createBook(), member)).body.error.code).toBe('MEMBER_HAS_OVERDUE');

    await giveBack({ transaction: first.body.data._id });
    await Setting.updateOne({ key: 'global' }, { maxOutstandingFine: 10 });
    const res = await issue(await createBook(), member);
    expect(res.body.error.code).toBe('OUTSTANDING_FINES');
  });

  it('returns 404 for unknown member or book', async () => {
    const missing = { _id: '507f1f77bcf86cd799439011' };
    expect((await issue(await createBook(), missing)).status).toBe(404);
    expect((await issue(missing, await createMember())).status).toBe(404);
  });

  it('validates custom due dates', async () => {
    const book = await createBook();
    const member = await createMember();
    const past = await issue(book, member, { dueDate: addDays(new Date(), -2).toISOString() });
    expect(past.body.error.code).toBe('INVALID_DUE_DATE');
    const tooFar = await issue(book, member, { dueDate: addDays(new Date(), 400).toISOString() });
    expect(tooFar.body.error.code).toBe('INVALID_DUE_DATE');
    const garbage = await issue(book, member, { dueDate: 'next tuesday' });
    expect(garbage.status).toBe(400);
    const ok = await issue(book, member, { dueDate: addDays(new Date(), 7).toISOString() });
    expect(ok.status).toBe(201);
  });

  it('only staff can issue books', async () => {
    const member = await createMember();
    const memberUser = await actor('MEMBER', { member: member._id });
    const res = await api()
      .post('/api/transactions/issue')
      .set('Authorization', memberUser.auth)
      .send({ book: (await createBook())._id.toString(), member: member._id.toString() });
    expect(res.status).toBe(403);
  });
});

describe('Returning books', () => {
  it('Scenario 5: return before the due date - no fine', async () => {
    const book = await createBook({ totalCopies: 2 });
    const member = await createMember();
    const issued = await issue(book, member);

    const res = await giveBack({ transaction: issued.body.data._id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'RETURNED', overdueDays: 0, fine: 0, fineStatus: 'NONE' });
    expect(res.body.data.returnDate).toBeTruthy();
    expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 2, issuedCopies: 0 });
    expect((await Member.findById(member._id)).currentBorrowedCount).toBe(0);
    await expectConsistent(book._id, member._id);
  });

  it('Scenario 6: return after the due date - fine = overdue days x daily rate', async () => {
    const book = await createBook();
    const member = await createMember();
    const issued = await issue(book, member);
    await backdate(issued.body.data._id, { issuedDaysAgo: 17, dueDaysAgo: 3 });

    const listed = await api().get('/api/transactions?status=OVERDUE').set('Authorization', librarian.auth);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0]).toMatchObject({ displayStatus: 'OVERDUE', currentOverdueDays: 3, accruedFine: 15 });

    const res = await giveBack({ transaction: issued.body.data._id });
    expect(res.body.data).toMatchObject({ overdueDays: 3, fine: 15, fineStatus: 'PENDING' });
    expect(res.body.data.fineBreakdown).toMatchObject({ overdue: 15, damage: 0, lost: 0 });
    await expectConsistent(book._id, member._id);
  });

  it('matches the worked example: due 10 Oct, returned 13 Oct -> 3 days', async () => {
    const book = await createBook();
    const member = await createMember();
    const issued = await issue(book, member);
    await Transaction.updateOne(
      { _id: issued.body.data._id },
      { issueDate: new Date(2025, 8, 26, 10), dueDate: endOfDay(new Date(2025, 9, 10)) }
    );
    const res = await giveBack({ transaction: issued.body.data._id, returnDate: new Date(2025, 9, 13, 11).toISOString() });
    expect(res.body.data).toMatchObject({ overdueDays: 3, fine: 15 });
  });

  it('uses the fine rate in force when the book was issued', async () => {
    const book = await createBook();
    const member = await createMember();
    const issued = await issue(book, member);
    await Setting.updateOne({ key: 'global' }, { finePerDay: 50 });
    await backdate(issued.body.data._id, { issuedDaysAgo: 16, dueDaysAgo: 2 });
    const res = await giveBack({ transaction: issued.body.data._id });
    expect(res.body.data.fine).toBe(10);
  });

  it('a damaged return adds the damage fee and moves the copy to damaged stock', async () => {
    const book = await createBook({ totalCopies: 2 });
    const member = await createMember();
    const issued = await issue(book, member);
    const res = await giveBack({ transaction: issued.body.data._id, condition: 'DAMAGED' });
    expect(res.body.data).toMatchObject({ fine: 100, returnCondition: 'DAMAGED' });
    expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 1, damagedCopies: 1, issuedCopies: 0 });
    await expectConsistent(book._id, member._id);
  });

  it('can identify the loan by book + member', async () => {
    const book = await createBook();
    const member = await createMember();
    await issue(book, member);
    const res = await giveBack({ book: book._id.toString(), member: member._id.toString() });
    expect(res.status).toBe(200);
  });

  it('a book cannot be returned twice', async () => {
    const book = await createBook();
    const member = await createMember();
    const issued = await issue(book, member);
    await giveBack({ transaction: issued.body.data._id });
    const again = await giveBack({ transaction: issued.body.data._id });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TRANSACTION_CLOSED');
    await expectConsistent(book._id, member._id);
  });

  it('rejects return dates in the future or before the issue date', async () => {
    const book = await createBook();
    const member = await createMember();
    const issued = await issue(book, member);
    const future = await giveBack({ transaction: issued.body.data._id, returnDate: addDays(new Date(), 3).toISOString() });
    expect(future.body.error.code).toBe('INVALID_RETURN_DATE');
    const before = await giveBack({ transaction: issued.body.data._id, returnDate: addDays(new Date(), -3).toISOString() });
    expect(before.body.error.code).toBe('INVALID_RETURN_DATE');
    await expectConsistent(book._id, member._id);
  });

  it('requires a transaction id or book + member', async () => {
    const res = await giveBack({ condition: 'GOOD' });
    expect(res.status).toBe(400);
  });

  it('supports the /api/issues alias', async () => {
    const book = await createBook();
    const member = await createMember();
    const created = await api()
      .post('/api/issues')
      .set('Authorization', librarian.auth)
      .send({ book: book._id.toString(), member: member._id.toString() });
    expect(created.status).toBe(201);
    const open = await api().get('/api/issues').set('Authorization', librarian.auth);
    expect(open.body.data).toHaveLength(1);
    const returned = await api()
      .post(`/api/issues/${created.body.data._id}/return`)
      .set('Authorization', librarian.auth)
      .send({});
    expect(returned.body.data.status).toBe('RETURNED');
  });
});

describe('Lost books, renewals and fines', () => {
  it('Scenario 7: a book is marked lost - copy moves to lost, replacement cost charged', async () => {
    const book = await createBook({ totalCopies: 2, price: 450 });
    const member = await createMember();
    const issued = await issue(book, member);
    await backdate(issued.body.data._id, { issuedDaysAgo: 16, dueDaysAgo: 2 });

    const res = await api()
      .post(`/api/transactions/${issued.body.data._id}/lost`)
      .set('Authorization', librarian.auth)
      .send({ remarks: 'Member reported loss' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'LOST', fine: 460, fineStatus: 'PENDING' });
    expect(res.body.data.fineBreakdown).toMatchObject({ overdue: 10, lost: 450 });
    expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 1, issuedCopies: 0, lostCopies: 1, totalCopies: 2 });
    expect((await Member.findById(member._id)).currentBorrowedCount).toBe(0);
    await expectConsistent(book._id, member._id);

    const again = await api().post(`/api/transactions/${issued.body.data._id}/lost`).set('Authorization', librarian.auth).send({});
    expect(again.status).toBe(409);
  });

  it('uses the configured lost-book fee when the book has no price', async () => {
    const book = await createBook({ price: 0 });
    const issued = await issue(book, await createMember());
    const res = await api().post(`/api/transactions/${issued.body.data._id}/lost`).set('Authorization', librarian.auth).send({});
    expect(res.body.data.fine).toBe(500);
  });

  it('renews a loan up to the renewal limit, but never an overdue loan', async () => {
    const book = await createBook();
    const member = await createMember();
    const issued = await issue(book, member);
    const id = issued.body.data._id;
    const renew = () => api().post(`/api/transactions/${id}/renew`).set('Authorization', librarian.auth).send({});

    const first = await renew();
    expect(first.status).toBe(200);
    expect(new Date(first.body.data.dueDate).getTime()).toBe(
      endOfDay(addDays(new Date(issued.body.data.dueDate), 14)).getTime()
    );
    expect((await renew()).body.data.renewCount).toBe(2);
    expect((await renew()).body.error.code).toBe('RENEWAL_LIMIT_REACHED');

    await backdate(id, { issuedDaysAgo: 30, dueDaysAgo: 1 });
    await Transaction.updateOne({ _id: id }, { renewCount: 0 });
    expect((await renew()).body.error.code).toBe('LOAN_OVERDUE');
  });

  it('records fine payments; only ADMIN can waive', async () => {
    const book = await createBook();
    const member = await createMember();
    const issued = await issue(book, member);
    await backdate(issued.body.data._id, { issuedDaysAgo: 20, dueDaysAgo: 4 });
    await giveBack({ transaction: issued.body.data._id });
    const id = issued.body.data._id;

    const waive = await api().post(`/api/transactions/${id}/fine`).set('Authorization', librarian.auth).send({ action: 'WAIVE' });
    expect(waive.status).toBe(403);

    const pay = await api().post(`/api/transactions/${id}/fine`).set('Authorization', librarian.auth).send({ action: 'PAY' });
    expect(pay.body.data).toMatchObject({ fineStatus: 'PAID', fine: 20 });

    const twice = await api().post(`/api/transactions/${id}/fine`).set('Authorization', librarian.auth).send({ action: 'PAY' });
    expect(twice.body.error.code).toBe('NO_PENDING_FINE');
  });
});

describe('History integrity and member privacy', () => {
  it('Scenario 9: deactivating a book keeps its transaction history', async () => {
    const admin = await actor('ADMIN');
    const book = await createBook({ title: 'Old Edition' });
    const member = await createMember();
    const issued = await issue(book, member);

    const blocked = await api().delete(`/api/books/${book._id}`).set('Authorization', admin.auth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('BOOK_HAS_ACTIVE_LOANS');

    await giveBack({ transaction: issued.body.data._id });
    const res = await api().delete(`/api/books/${book._id}`).set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect((await Book.findById(book._id)).status).toBe('INACTIVE');

    const history = await api().get(`/api/books/${book._id}/transactions`).set('Authorization', admin.auth);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].book.title).toBe('Old Edition');

    const reissue = await issue(book, await createMember());
    expect(reissue.body.error.code).toBe('BOOK_INACTIVE');
  });

  it('a MEMBER only sees their own transactions', async () => {
    const me = await createMember({ name: 'Me' });
    const other = await createMember({ name: 'Other' });
    const book = await createBook({ totalCopies: 2 });
    await issue(book, me);
    const theirs = await issue(book, other);
    const memberUser = await actor('MEMBER', { member: me._id });

    const list = await api().get(`/api/transactions?member=${other._id}`).set('Authorization', memberUser.auth);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].member.name).toBe('Me');

    const peek = await api().get(`/api/transactions/${theirs.body.data._id}`).set('Authorization', memberUser.auth);
    expect(peek.status).toBe(404);
  });
});
