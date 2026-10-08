const { api, useTestDatabase, actor, createBook, createMember, createCategory } = require('./helpers/setup');
const { Transaction } = require('../src/models');
const { addDays, endOfDay } = require('../src/utils/dates');

useTestDatabase();

async function seedActivity(auth) {
  const science = await createCategory('Science');
  const fiction = await createCategory('Fiction');
  const physics = await createBook({ title: 'Physics 101', category: science._id, totalCopies: 3 });
  const novel = await createBook({ title: 'A Novel', category: fiction._id, totalCopies: 2 });
  const asha = await createMember({ name: 'Asha', borrowingLimit: 5 });
  const ben = await createMember({ name: 'Ben', borrowingLimit: 5 });

  const issue = (book, member) =>
    api()
      .post('/api/transactions/issue')
      .set('Authorization', auth)
      .send({ book: book._id.toString(), member: member._id.toString() });

  const t1 = await issue(physics, asha);
  await issue(physics, ben);
  const t3 = await issue(novel, asha);
  // t1 becomes overdue by 2 days and is returned late; t3 becomes overdue and stays open.
  await Transaction.updateOne({ _id: t1.body.data._id }, { dueDate: endOfDay(addDays(new Date(), -2)) });
  await api().post('/api/transactions/return').set('Authorization', auth).send({ transaction: t1.body.data._id });
  await Transaction.updateOne({ _id: t3.body.data._id }, { dueDate: endOfDay(addDays(new Date(), -5)) });
  return { science, fiction, physics, novel, asha, ben };
}

describe('Reports', () => {
  it('dashboard aggregates inventory, members, overdue, fines and charts', async () => {
    const { auth } = await actor('ADMIN');
    await seedActivity(auth);
    const res = await api().get('/api/reports/dashboard').set('Authorization', auth);

    expect(res.status).toBe(200);
    const { totals, charts, recent } = res.body.data;
    expect(totals).toMatchObject({
      titles: 2,
      totalBooks: 5,
      issuedBooks: 2,
      availableBooks: 3,
      overdueBooks: 1,
      totalMembers: 2,
    });
    expect(totals.fines).toMatchObject({ pending: 10, accruing: 25 });
    expect(charts.booksByCategory.map((c) => c.name).sort()).toEqual(['Fiction', 'Science']);
    expect(charts.monthly).toHaveLength(12);
    expect(charts.monthly[11]).toMatchObject({ issues: 3, returns: 1 });
    expect(charts.popularBooks[0]).toMatchObject({ title: 'Physics 101', issueCount: 2 });
    expect(charts.topBorrowers[0]).toMatchObject({ name: 'Asha', loans: 2 });
    expect(recent.overdue).toHaveLength(1);
    expect(recent.returned).toHaveLength(1);
  });

  it('overdue report lists open overdue loans with accrued fines, filterable by category', async () => {
    const { auth } = await actor('LIBRARIAN');
    const { science, fiction } = await seedActivity(auth);
    const all = await api().get('/api/reports/overdue').set('Authorization', auth);
    expect(all.body.data.summary).toMatchObject({ count: 1, totalAccruedFine: 25 });
    expect(all.body.data.items[0].currentOverdueDays).toBe(5);

    const sci = await api().get(`/api/reports/overdue?category=${science._id}`).set('Authorization', auth);
    expect(sci.body.data.items).toHaveLength(0);
    const fic = await api().get(`/api/reports/overdue?category=${fiction._id}`).set('Authorization', auth);
    expect(fic.body.data.items).toHaveLength(1);
  });

  it('popular books, books by status, category stats, fines and member history', async () => {
    const { auth } = await actor('LIBRARIAN');
    const { asha } = await seedActivity(auth);
    const get = (url) => api().get(url).set('Authorization', auth);

    expect((await get('/api/reports/popular-books?limit=1')).body.data).toHaveLength(1);
    expect((await get('/api/reports/books?status=issued')).body.data.summary).toMatchObject({ titles: 2, issuedCopies: 2 });
    const cats = (await get('/api/reports/categories')).body.data;
    expect(cats.find((c) => c.name === 'Science')).toMatchObject({ issues: 2, totalCopies: 3 });
    expect((await get('/api/reports/fines')).body.data.summary).toMatchObject({ pending: 10, collected: 0 });

    const history = (await get(`/api/reports/member-history?member=${asha._id}`)).body.data;
    expect(history.items).toHaveLength(2);
    expect(history.stats).toMatchObject({ totalLoans: 2, activeLoans: 1, overdueLoans: 1, pendingFines: 10 });
  });

  it('rejects inverted date ranges', async () => {
    const { auth } = await actor('LIBRARIAN');
    const res = await api().get('/api/reports/popular-books?from=2026-05-01&to=2026-01-01').set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  it('reports are staff-only', async () => {
    const member = await createMember();
    const { auth } = await actor('MEMBER', { member: member._id });
    expect((await api().get('/api/reports/dashboard').set('Authorization', auth)).status).toBe(403);
  });
});

describe('Settings', () => {
  it('everyone can read settings; only ADMIN can change the fine rate', async () => {
    const lib = await actor('LIBRARIAN');
    const admin = await actor('ADMIN');
    const read = await api().get('/api/settings').set('Authorization', lib.auth);
    expect(read.body.data).toMatchObject({ finePerDay: 5, loanPeriodDays: 14 });

    expect((await api().put('/api/settings').set('Authorization', lib.auth).send({ finePerDay: 1 })).status).toBe(403);
    const changed = await api().put('/api/settings').set('Authorization', admin.auth).send({ finePerDay: 2.5 });
    expect(changed.body.data.finePerDay).toBe(2.5);

    const invalid = await api().put('/api/settings').set('Authorization', admin.auth).send({ finePerDay: -1 });
    expect(invalid.status).toBe(400);
    const conflict = await api().put('/api/settings').set('Authorization', admin.auth).send({ loanPeriodDays: 80 });
    expect(conflict.body.error.code).toBe('INVALID_LOAN_PERIOD');
  });
});
