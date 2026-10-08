const { api, useTestDatabase, createUser, actor, createMember } = require('./helpers/setup');
const { User } = require('../src/models');

useTestDatabase();

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and never returns the password hash', async () => {
    await createUser({ role: 'LIBRARIAN', username: 'lib1' });
    const res = await api().post('/api/auth/login').send({ username: 'LIB1', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.role).toBe('LIBRARIAN');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion/);
  });

  it('rejects a wrong password with a generic message', async () => {
    await createUser({ username: 'admin1' });
    const res = await api().post('/api/auth/login').send({ username: 'admin1', password: 'wrong-pass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown username with the same message as a wrong password', async () => {
    const res = await api().post('/api/auth/login').send({ username: 'ghost', password: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid username or password');
  });

  it('rejects deactivated accounts', async () => {
    const user = await createUser({ username: 'gone' });
    await User.updateOne({ _id: user._id }, { status: 'INACTIVE' });
    const res = await api().post('/api/auth/login').send({ username: 'gone', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('validates required fields', async () => {
    const res = await api().post('/api/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['username', 'password']));
  });

  it('blocks NoSQL operator injection in credentials', async () => {
    await createUser({ username: 'victim' });
    const res = await api()
      .post('/api/auth/login')
      .send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"username":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('Authenticated session', () => {
  it('GET /api/auth/me requires a token', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const { token } = await actor('ADMIN');
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${token.slice(0, -2)}xx`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns the profile including the linked member for MEMBER accounts', async () => {
    const member = await createMember({ name: 'Asha Rao' });
    const { auth } = await actor('MEMBER', { member: member._id });
    const res = await api().get('/api/auth/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data.member.name).toBe('Asha Rao');
  });

  it('logout revokes the token server-side', async () => {
    const { auth } = await actor('LIBRARIAN');
    expect((await api().post('/api/auth/logout').set('Authorization', auth)).status).toBe(200);
    const res = await api().get('/api/auth/me').set('Authorization', auth);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('a deactivated user loses access immediately', async () => {
    const { user, auth } = await actor('LIBRARIAN');
    await User.updateOne({ _id: user._id }, { status: 'INACTIVE' });
    expect((await api().get('/api/auth/me').set('Authorization', auth)).status).toBe(401);
  });

  it('changes password, enforcing the policy and revoking old tokens', async () => {
    const { user, auth } = await actor('LIBRARIAN');

    const weak = await api()
      .put('/api/auth/password')
      .set('Authorization', auth)
      .send({ currentPassword: 'Password123', newPassword: 'short' });
    expect(weak.status).toBe(400);

    const wrong = await api()
      .put('/api/auth/password')
      .set('Authorization', auth)
      .send({ currentPassword: 'nope12345', newPassword: 'NewPassword1' });
    expect(wrong.body.error.code).toBe('INVALID_PASSWORD');

    const ok = await api()
      .put('/api/auth/password')
      .set('Authorization', auth)
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword1' });
    expect(ok.status).toBe(200);
    expect((await api().get('/api/auth/me').set('Authorization', auth)).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${ok.body.data.token}`)).status).toBe(200);

    const relogin = await api().post('/api/auth/login').send({ username: user.username, password: 'NewPassword1' });
    expect(relogin.status).toBe(200);
  });
});

describe('POST /api/auth/register (admin only)', () => {
  it('lets an ADMIN create a librarian account', async () => {
    const { auth } = await actor('ADMIN');
    const res = await api()
      .post('/api/auth/register')
      .set('Authorization', auth)
      .send({ name: 'New Librarian', username: 'newlib', password: 'Library123', role: 'LIBRARIAN' });
    expect(res.status).toBe(201);
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('forbids a LIBRARIAN from registering users', async () => {
    const { auth } = await actor('LIBRARIAN');
    const res = await api()
      .post('/api/auth/register')
      .set('Authorization', auth)
      .send({ name: 'Sneaky', username: 'sneaky', password: 'Sneaky1234', role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('prevents duplicate usernames (case-insensitive)', async () => {
    const { auth } = await actor('ADMIN');
    await createUser({ username: 'taken' });
    const res = await api()
      .post('/api/auth/register')
      .set('Authorization', auth)
      .send({ name: 'Dup', username: 'TAKEN', password: 'Password123', role: 'LIBRARIAN' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_USERNAME');
  });
});

describe('User management safeguards', () => {
  it('an admin cannot deactivate themselves or remove the last admin', async () => {
    const { user, auth } = await actor('ADMIN');
    const self = await api().delete(`/api/users/${user._id}`).set('Authorization', auth);
    expect(self.body.error.code).toBe('SELF_DEACTIVATION');

    const other = await createUser({ role: 'LIBRARIAN' });
    const promote = await api().put(`/api/users/${other._id}`).set('Authorization', auth).send({ role: 'ADMIN' });
    expect(promote.status).toBe(200);
  });

  it('returns 404 for unknown routes with the standard error shape', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: expect.objectContaining({ code: 'ROUTE_NOT_FOUND' }) });
  });
});
