/**
 * Scenario 10: many librarians operate at the same moment. Requests are fired
 * in parallel against the real replica set; inventory must never oversell and
 * counters must match the transaction records afterwards.
 */
const { api, useTestDatabase, actor, createBook, createMember } = require('./helpers/setup');
const { Book, Member, Transaction } = require('../src/models');

useTestDatabase();

let librarian;
beforeEach(async () => {
  librarian = await actor('LIBRARIAN');
});

const issue = (bookId, memberId) =>
  api()
    .post('/api/transactions/issue')
    .set('Authorization', librarian.auth)
    .send({ book: bookId.toString(), member: memberId.toString() });

it('never issues more copies than exist when many members race for them', async () => {
  const book = await createBook({ totalCopies: 3 });
  const members = await Promise.all(Array.from({ length: 10 }, (_, i) => createMember({ name: `Racer ${i}` })));

  const results = await Promise.all(members.map((m) => issue(book._id, m._id)));
  const ok = results.filter((r) => r.status === 201);
  const refused = results.filter((r) => r.status === 409);

  expect(ok).toHaveLength(3);
  expect(refused).toHaveLength(7);
  refused.forEach((r) => expect(r.body.error.code).toBe('NO_COPIES_AVAILABLE'));

  const fresh = await Book.findById(book._id);
  expect(fresh).toMatchObject({ availableCopies: 0, issuedCopies: 3 });
  expect(await Transaction.countDocuments({ book: book._id, status: 'ISSUED' })).toBe(3);
  const borrowed = await Member.aggregate([{ $group: { _id: null, n: { $sum: '$currentBorrowedCount' } } }]);
  expect(borrowed[0].n).toBe(3);
});

it('never lets one member exceed the borrowing limit under parallel requests', async () => {
  const member = await createMember({ borrowingLimit: 2 });
  const books = await Promise.all(Array.from({ length: 6 }, () => createBook({ totalCopies: 5 })));

  const results = await Promise.all(books.map((b) => issue(b._id, member._id)));
  expect(results.filter((r) => r.status === 201)).toHaveLength(2);

  expect((await Member.findById(member._id)).currentBorrowedCount).toBe(2);
  expect(await Transaction.countDocuments({ member: member._id, status: 'ISSUED' })).toBe(2);
  const issuedTotal = (await Book.find()).reduce((sum, b) => sum + b.issuedCopies, 0);
  expect(issuedTotal).toBe(2);
});

it('the same member double-clicking "issue" gets exactly one loan', async () => {
  const member = await createMember();
  const book = await createBook({ totalCopies: 5 });
  const results = await Promise.all([1, 2, 3, 4].map(() => issue(book._id, member._id)));

  expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 4, issuedCopies: 1 });
  expect((await Member.findById(member._id)).currentBorrowedCount).toBe(1);
});

it('a loan returned concurrently by two librarians is only counted once', async () => {
  const member = await createMember();
  const book = await createBook({ totalCopies: 1 });
  const issued = await issue(book._id, member._id);
  const id = issued.body.data._id;

  const results = await Promise.all(
    [1, 2, 3].map(() => api().post('/api/transactions/return').set('Authorization', librarian.auth).send({ transaction: id }))
  );
  expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 1, issuedCopies: 0 });
  expect((await Member.findById(member._id)).currentBorrowedCount).toBe(0);
});

it('mixed parallel issues and returns leave inventory consistent', async () => {
  const book = await createBook({ totalCopies: 4 });
  const members = await Promise.all(Array.from({ length: 8 }, (_, i) => createMember({ name: `Mixed ${i}` })));

  // Four loans exist up front; return them while four other members try to borrow.
  const first = await Promise.all(members.slice(0, 4).map((m) => issue(book._id, m._id)));
  const returns = first.map((r) =>
    api().post('/api/transactions/return').set('Authorization', librarian.auth).send({ transaction: r.body.data._id })
  );
  const issues = members.slice(4).map((m) => issue(book._id, m._id));
  await Promise.all([...returns, ...issues]);

  const fresh = await Book.findById(book._id);
  const open = await Transaction.countDocuments({ book: book._id, status: 'ISSUED' });
  expect(fresh.issuedCopies).toBe(open);
  expect(fresh.availableCopies + fresh.issuedCopies).toBe(4);
  expect(fresh.availableCopies).toBeGreaterThanOrEqual(0);
});
