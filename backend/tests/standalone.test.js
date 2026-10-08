/**
 * Same race scenarios against a STANDALONE mongod, where multi-document
 * transactions are unavailable. Consistency then relies on the atomic
 * conditional updates plus compensation in services/unitOfWork.js.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase, disconnectDatabase, supportsTransactions } = require('../src/config/db');
const { api, actor, createBook, createMember } = require('./helpers/setup');
const { Book, Member, Transaction } = require('../src/models');

let server;
let librarian;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await connectDatabase(server.getUri('bms_standalone'));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
  await server.stop();
});

beforeEach(async () => {
  librarian = await actor('LIBRARIAN');
});

const issue = (bookId, memberId) =>
  api()
    .post('/api/transactions/issue')
    .set('Authorization', librarian.auth)
    .send({ book: bookId.toString(), member: memberId.toString() });

it('detects that transactions are unavailable', async () => {
  expect(await supportsTransactions()).toBe(false);
});

it('does not oversell copies without transactions', async () => {
  const book = await createBook({ totalCopies: 2 });
  const members = await Promise.all(Array.from({ length: 8 }, () => createMember()));
  const results = await Promise.all(members.map((m) => issue(book._id, m._id)));

  expect(results.filter((r) => r.status === 201)).toHaveLength(2);
  expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 0, issuedCopies: 2 });
  expect(await Transaction.countDocuments({ book: book._id })).toBe(2);
  const borrowed = await Member.aggregate([
    { $match: { _id: { $in: members.map((m) => m._id) } } },
    { $group: { _id: null, n: { $sum: '$currentBorrowedCount' } } },
  ]);
  // Members whose issue failed had their increment compensated.
  expect(borrowed[0].n).toBe(2);
});

it('compensates the member counter when the duplicate-loan index rejects a request', async () => {
  const member = await createMember();
  const book = await createBook({ totalCopies: 5 });
  const results = await Promise.all([1, 2, 3].map(() => issue(book._id, member._id)));

  expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  expect((await Member.findById(member._id)).currentBorrowedCount).toBe(1);
  expect(await Book.findById(book._id)).toMatchObject({ availableCopies: 4, issuedCopies: 1 });
});
