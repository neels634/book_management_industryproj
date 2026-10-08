const mongoose = require('mongoose');
const request = require('supertest');
const { connectDatabase, disconnectDatabase } = require('../../src/config/db');
const createApp = require('../../src/app');
const { User, Category, Book, Member } = require('../../src/models');
const { completeIsbn13 } = require('../../src/utils/isbn');

const app = createApp();
const api = () => request(app);

let isbnCounter = 0;
/** Unique, checksum-valid ISBN-13 for each call. */
function uniqueIsbn() {
  isbnCounter += 1;
  const body = `978${String(Date.now() % 1e6).padStart(6, '0')}${String(isbnCounter).padStart(3, '0')}`;
  return completeIsbn13(body.slice(0, 12));
}

/** Each test file gets its own database on the shared replica set. */
function useTestDatabase() {
  beforeAll(async () => {
    const base = process.env.MONGO_TEST_URI;
    const dbName = `bms_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    const url = new URL(base);
    url.pathname = `/${dbName}`;
    await connectDatabase(url.toString());
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });
}

async function createUser({ role = 'ADMIN', username, password = 'Password123', name, member = null } = {}) {
  const uname = username || `${role.toLowerCase()}${Math.random().toString(36).slice(2, 7)}`;
  return User.create({
    name: name || `${role} user`,
    username: uname,
    passwordHash: await User.hashPassword(password),
    role,
    member,
  });
}

async function login(username, password = 'Password123') {
  const res = await api().post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

/** Creates a user with the role and returns { user, token, auth } where auth is the header value. */
async function actor(role = 'ADMIN', extra = {}) {
  const user = await createUser({ role, ...extra });
  const token = await login(user.username);
  return { user, token, auth: `Bearer ${token}` };
}

async function createCategory(name = `Category ${Math.random().toString(36).slice(2, 7)}`) {
  return Category.create({ name });
}

async function createBook(overrides = {}) {
  const category = overrides.category || (await createCategory())._id;
  const totalCopies = overrides.totalCopies ?? 3;
  return Book.create({
    bookId: `BK-T${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Book',
    isbn: uniqueIsbn(),
    authors: ['Test Author'],
    category,
    availableCopies: totalCopies,
    issuedCopies: 0,
    damagedCopies: 0,
    lostCopies: 0,
    ...overrides,
    totalCopies,
  });
}

async function createMember(overrides = {}) {
  return Member.create({
    memberId: `MEM-T${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Member',
    phone: '+91 98765 43210',
    borrowingLimit: 3,
    ...overrides,
  });
}

module.exports = {
  app,
  api,
  useTestDatabase,
  createUser,
  login,
  actor,
  createCategory,
  createBook,
  createMember,
  uniqueIsbn,
};
