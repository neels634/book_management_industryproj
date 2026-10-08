const { api, useTestDatabase, actor, createCategory, createBook, createMember, uniqueIsbn } = require('./helpers/setup');
const { Book, Category } = require('../src/models');

useTestDatabase();

const bookPayload = (category, overrides = {}) => ({
  title: 'Clean Architecture',
  isbn: uniqueIsbn(),
  authors: 'Robert C. Martin, Another Author',
  publisher: 'Prentice Hall',
  publishedYear: 2017,
  category: category.toString(),
  totalCopies: 4,
  price: 650,
  ...overrides,
});

describe('Categories', () => {
  it('ADMIN creates categories; names are unique case-insensitively', async () => {
    const { auth } = await actor('ADMIN');
    const first = await api().post('/api/categories').set('Authorization', auth).send({ name: 'Science' });
    expect(first.status).toBe(201);
    const dup = await api().post('/api/categories').set('Authorization', auth).send({ name: 'science' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_CATEGORY');
  });

  it('LIBRARIAN can list but not manage categories', async () => {
    const { auth } = await actor('LIBRARIAN');
    expect((await api().get('/api/categories').set('Authorization', auth)).status).toBe(200);
    expect((await api().post('/api/categories').set('Authorization', auth).send({ name: 'History' })).status).toBe(403);
  });

  it('lists book counts and blocks deactivating a category with active books', async () => {
    const { auth } = await actor('ADMIN');
    const category = await createCategory('Technology');
    await createBook({ category: category._id, totalCopies: 5 });

    const list = await api().get('/api/categories').set('Authorization', auth);
    expect(list.body.data[0]).toMatchObject({ name: 'Technology', bookCount: 1, totalCopies: 5 });

    const res = await api().delete(`/api/categories/${category._id}`).set('Authorization', auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_IN_USE');
  });

  it('soft-deletes an unused category', async () => {
    const { auth } = await actor('ADMIN');
    const category = await createCategory('Poetry');
    const res = await api().delete(`/api/categories/${category._id}`).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect((await Category.findById(category._id)).status).toBe('INACTIVE');
  });
});

describe('Books', () => {
  it('Scenario 1: a librarian adds 100 copies across different books', async () => {
    const { auth } = await actor('LIBRARIAN');
    const category = await createCategory('Fiction');
    const copies = [10, 20, 30, 40];
    for (const [i, totalCopies] of copies.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const res = await api()
        .post('/api/books')
        .set('Authorization', auth)
        .send(bookPayload(category._id, { title: `Book ${i}`, totalCopies }));
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ totalCopies, availableCopies: totalCopies, issuedCopies: 0 });
      expect(res.body.data.bookId).toMatch(/^BK-\d{5}$/);
    }
    const books = await Book.find();
    expect(books.reduce((sum, b) => sum + b.totalCopies, 0)).toBe(100);
    expect(new Set(books.map((b) => b.bookId)).size).toBe(4);
  });

  it('normalises ISBNs and rejects invalid check digits and duplicates', async () => {
    const { auth } = await actor('LIBRARIAN');
    const category = await createCategory();

    const ok = await api()
      .post('/api/books')
      .set('Authorization', auth)
      .send(bookPayload(category._id, { isbn: '978-0-13-468599-1' }));
    expect(ok.status).toBe(201);
    expect(ok.body.data.isbn).toBe('9780134685991');

    const bad = await api()
      .post('/api/books')
      .set('Authorization', auth)
      .send(bookPayload(category._id, { isbn: '978-0-13-468599-2' }));
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].field).toBe('isbn');

    const dup = await api()
      .post('/api/books')
      .set('Authorization', auth)
      .send(bookPayload(category._id, { isbn: '9780134685991' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_ISBN');
  });

  it('validates required fields and value ranges', async () => {
    const { auth } = await actor('LIBRARIAN');
    const res = await api()
      .post('/api/books')
      .set('Authorization', auth)
      .send({ title: '', authors: [], totalCopies: 0, publishedYear: 3000, category: 'not-an-id' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'isbn', 'authors', 'totalCopies', 'publishedYear', 'category']));
  });

  it('ignores attempts to set inventory counters directly (mass assignment)', async () => {
    const { auth } = await actor('LIBRARIAN');
    const category = await createCategory();
    const res = await api()
      .post('/api/books')
      .set('Authorization', auth)
      .send(bookPayload(category._id, { totalCopies: 2, availableCopies: 99, issuedCopies: 50 }));
    expect(res.body.data).toMatchObject({ totalCopies: 2, availableCopies: 2, issuedCopies: 0 });
  });

  it('searches, filters, sorts and paginates', async () => {
    const { auth } = await actor('LIBRARIAN');
    const sci = await createCategory('Science');
    const fic = await createCategory('Fiction');
    await createBook({ title: 'A Brief History of Time', authors: ['Stephen Hawking'], category: sci._id });
    await createBook({ title: 'Cosmos', authors: ['Carl Sagan'], category: sci._id, totalCopies: 1, availableCopies: 0, issuedCopies: 1 });
    await createBook({ title: 'Dune', authors: ['Frank Herbert'], category: fic._id });

    const search = await api().get('/api/books?q=sagan').set('Authorization', auth);
    expect(search.body.data.map((b) => b.title)).toEqual(['Cosmos']);

    const filtered = await api().get(`/api/books?category=${sci._id}&availability=available`).set('Authorization', auth);
    expect(filtered.body.data.map((b) => b.title)).toEqual(['A Brief History of Time']);

    const sorted = await api().get('/api/books?sortBy=title&order=desc&limit=2').set('Authorization', auth);
    expect(sorted.body.data.map((b) => b.title)).toEqual(['Dune', 'Cosmos']);
    expect(sorted.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const regexAttack = await api().get('/api/books?q=(a+)+$').set('Authorization', auth);
    expect(regexAttack.status).toBe(200);
  });

  it('increasing total copies adds available copies; cannot reduce below copies on the shelf', async () => {
    const { auth } = await actor('LIBRARIAN');
    const book = await createBook({ totalCopies: 3, availableCopies: 1, issuedCopies: 2 });

    const up = await api().put(`/api/books/${book._id}`).set('Authorization', auth).send({ totalCopies: 5 });
    expect(up.body.data).toMatchObject({ totalCopies: 5, availableCopies: 3, issuedCopies: 2 });

    const down = await api().put(`/api/books/${book._id}`).set('Authorization', auth).send({ totalCopies: 1 });
    expect(down.status).toBe(409);
    expect(down.body.error.code).toBe('INSUFFICIENT_AVAILABLE_COPIES');
  });

  it('moves copies between damaged / lost / available buckets atomically', async () => {
    const { auth } = await actor('LIBRARIAN');
    const book = await createBook({ totalCopies: 4 });
    const move = (action, quantity) =>
      api().patch(`/api/books/${book._id}/copies`).set('Authorization', auth).send({ action, quantity });

    expect((await move('MARK_DAMAGED', 2)).body.data).toMatchObject({ availableCopies: 2, damagedCopies: 2 });
    expect((await move('REPAIR', 1)).body.data).toMatchObject({ availableCopies: 3, damagedCopies: 1 });
    expect((await move('WRITE_OFF_DAMAGED', 1)).body.data).toMatchObject({ totalCopies: 3, damagedCopies: 0 });
    const tooMany = await move('MARK_DAMAGED', 10);
    expect(tooMany.status).toBe(409);
  });

  it('MEMBER sees only active books, and cannot modify the catalogue', async () => {
    const member = await createMember();
    const { auth } = await actor('MEMBER', { member: member._id });
    await createBook({ title: 'Visible' });
    const hidden = await createBook({ title: 'Withdrawn', status: 'INACTIVE' });

    const list = await api().get('/api/books?status=INACTIVE').set('Authorization', auth);
    expect(list.body.data.map((b) => b.title)).toEqual(['Visible']);
    expect((await api().get(`/api/books/${hidden._id}`).set('Authorization', auth)).status).toBe(404);
    expect((await api().post('/api/books').set('Authorization', auth).send({})).status).toBe(403);
    expect((await api().delete(`/api/books/${hidden._id}`).set('Authorization', auth)).status).toBe(403);
  });

  it('returns 400 for malformed ids and 404 for missing books', async () => {
    const { auth } = await actor('LIBRARIAN');
    expect((await api().get('/api/books/123').set('Authorization', auth)).status).toBe(400);
    expect((await api().get('/api/books/507f1f77bcf86cd799439011').set('Authorization', auth)).status).toBe(404);
  });
});

describe('Members', () => {
  it('registers a member with an auto ID, default limit and optional login', async () => {
    const { auth } = await actor('LIBRARIAN');
    const res = await api()
      .post('/api/members')
      .set('Authorization', auth)
      .send({
        name: 'Priya Sharma',
        email: 'Priya@Example.com',
        phone: '+91 98200 11111',
        login: { username: 'priya', password: 'Reader123' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ borrowingLimit: 3, email: 'priya@example.com', membershipStatus: 'ACTIVE' });
    expect(res.body.data.memberId).toMatch(/^MEM-\d{5}$/);

    const loginRes = await api().post('/api/auth/login').send({ username: 'priya', password: 'Reader123' });
    expect(loginRes.body.data.user.member.memberId).toBe(res.body.data.memberId);
  });

  it('rejects invalid phone/e-mail/dates and duplicate e-mails', async () => {
    const { auth } = await actor('LIBRARIAN');
    const bad = await api()
      .post('/api/members')
      .set('Authorization', auth)
      .send({ name: 'X', phone: 'abc', email: 'nope', membershipDate: '2026-01-10', membershipExpiry: '2025-01-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'phone', 'email']));

    const dates = await api()
      .post('/api/members')
      .set('Authorization', auth)
      .send({ name: 'Valid Name', phone: '9876543210', membershipDate: '2026-01-10', membershipExpiry: '2025-01-01' });
    expect(dates.status).toBe(400);
    expect(dates.body.error.details[0].field).toBe('membershipExpiry');

    const invalidDate = await api()
      .post('/api/members')
      .set('Authorization', auth)
      .send({ name: 'Valid Name', phone: '9876543210', membershipDate: '2026-02-31x' });
    expect(invalidDate.status).toBe(400);

    await createMember({ email: 'dup@example.com' });
    const dup = await api()
      .post('/api/members')
      .set('Authorization', auth)
      .send({ name: 'Another', phone: '9876543210', email: 'dup@example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('allows several members without an e-mail', async () => {
    const { auth } = await actor('LIBRARIAN');
    for (const name of ['No Mail One', 'No Mail Two']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await api().post('/api/members').set('Authorization', auth).send({ name, phone: '9876543210', email: '' });
      expect(res.status).toBe(201);
    }
  });

  it('edits, searches and soft-deletes members', async () => {
    const { auth } = await actor('LIBRARIAN');
    const member = await createMember({ name: 'Rahul Verma' });

    const edit = await api().put(`/api/members/${member._id}`).set('Authorization', auth).send({ borrowingLimit: 5 });
    expect(edit.body.data.borrowingLimit).toBe(5);

    const search = await api().get('/api/members?q=verma').set('Authorization', auth);
    expect(search.body.data).toHaveLength(1);

    const del = await api().delete(`/api/members/${member._id}`).set('Authorization', auth);
    expect(del.status).toBe(200);
    expect(del.body.data.membershipStatus).toBe('INACTIVE');
  });

  it('cannot close the membership of someone with books on loan', async () => {
    const { auth } = await actor('LIBRARIAN');
    const member = await createMember({ currentBorrowedCount: 1 });
    const res = await api().delete(`/api/members/${member._id}`).set('Authorization', auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEMBER_HAS_ACTIVE_LOANS');
  });

  it('MEMBER role cannot access the member directory', async () => {
    const member = await createMember();
    const { auth } = await actor('MEMBER', { member: member._id });
    expect((await api().get('/api/members').set('Authorization', auth)).status).toBe(403);
  });
});
