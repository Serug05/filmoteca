import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { addUser, makeApp, sessionCookie } from './helpers.js';

const ANA = { username: 'ana', email: 'ana@test.ro', password: 'parola-sigura-123' };

describe('Înregistrare', () => {
  test('creează contul, pornește sesiunea și nu trimite înapoi hash-ul parolei', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/auth/register').send(ANA);

    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body.user).sort(), ['email', 'id', 'role', 'username']);
    assert.equal(res.body.user.role, 'user');

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sid='));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
  });

  test('prin HTTPS, cookie-ul de sesiune primește automat marcajul Secure', async () => {
    const { app } = makeApp({ trustProxy: 1 });
    const viaHttps = await request(app).post('/api/auth/register').set('X-Forwarded-Proto', 'https').send(ANA);
    assert.match(viaHttps.headers['set-cookie'].find((c) => c.startsWith('sid=')), /;\s*Secure/i);

    const viaHttp = await request(app).post('/api/auth/login').send({ email: ANA.email, password: ANA.password });
    assert.doesNotMatch(viaHttp.headers['set-cookie'].find((c) => c.startsWith('sid=')), /;\s*Secure/i);
  });

  test('parola este salvată ca hash Argon2id, nu în clar', async () => {
    const { app, db } = makeApp();
    await request(app).post('/api/auth/register').send(ANA).expect(201);

    const { password_hash: hash } = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(ANA.email);
    assert.match(hash, /^\$argon2id\$/);
    assert.ok(!hash.includes(ANA.password));
  });

  test('un câmp „role” trimis de client este respins (nu te poți face singur admin)', async () => {
    const { app, db } = makeApp();
    const res = await request(app).post('/api/auth/register').send({ ...ANA, role: 'admin' });

    assert.equal(res.status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
  });

  test('serverul validează datele și explică fiecare eroare', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', email: 'nu-e-email', password: 'scurta' });

    assert.equal(res.status, 400);
    assert.ok(res.body.fields.username);
    assert.ok(res.body.fields.email);
    assert.ok(res.body.fields.password);
  });

  test('un email deja folosit este respins', async () => {
    const { app } = makeApp();
    await request(app).post('/api/auth/register').send(ANA).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...ANA, username: 'alt-nume', email: 'ANA@test.ro' });

    assert.equal(res.status, 409);
  });
});

describe('Autentificare și sesiuni', () => {
  test('parola greșită și emailul inexistent primesc exact același răspuns', async () => {
    const { app, db } = makeApp();
    await addUser(db, ANA);

    const wrongPassword = await request(app).post('/api/auth/login').send({ email: ANA.email, password: 'gresita-123' });
    const noAccount = await request(app).post('/api/auth/login').send({ email: 'nimeni@test.ro', password: 'gresita-123' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(noAccount.status, 401);
    assert.deepEqual(wrongPassword.body, noAccount.body);
  });

  test('după login, sesiunea rămâne activă între cereri', async () => {
    const { app, db } = makeApp();
    await addUser(db, ANA);
    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ email: ANA.email, password: ANA.password }).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);

    assert.equal(me.body.user.username, 'ana');
  });

  test('logout-ul invalidează sesiunea pe server, nu doar în browser', async () => {
    const { app, db } = makeApp();
    await addUser(db, ANA);

    const login = await request(app).post('/api/auth/login').send({ email: ANA.email, password: ANA.password });
    const cookie = sessionCookie(login);

    await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(204);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);

    assert.equal(me.body.user, null);
  });

  test('fiecare login emite un token nou și îl anulează pe cel vechi', async () => {
    const { app, db } = makeApp();
    await addUser(db, ANA);
    const credentials = { email: ANA.email, password: ANA.password };

    const first = sessionCookie(await request(app).post('/api/auth/login').send(credentials));
    const second = sessionCookie(await request(app).post('/api/auth/login').set('Cookie', first).send(credentials));

    assert.notEqual(first, second);
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', first)).body.user, null);
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', second)).body.user.username, 'ana');
  });

  test('un token inventat sau expirat nu autentifică pe nimeni', async () => {
    const { app, db } = makeApp();
    await addUser(db, ANA);

    const fake = await request(app).get('/api/auth/me').set('Cookie', `sid=${'A'.repeat(43)}`);
    assert.equal(fake.body.user, null);

    const cookie = sessionCookie(await request(app).post('/api/auth/login').send({ email: ANA.email, password: ANA.password }));
    db.prepare('UPDATE sessions SET expires_at = 0').run();
    const expired = await request(app).get('/api/auth/me').set('Cookie', cookie);
    assert.equal(expired.body.user, null);
  });

  test('un cont blocat nu se mai poate autentifica și își pierde sesiunea', async () => {
    const { app, db } = makeApp();
    const user = await addUser(db, ANA);
    const cookie = sessionCookie(await request(app).post('/api/auth/login').send({ email: ANA.email, password: ANA.password }));

    db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(user.id);

    const login = await request(app).post('/api/auth/login').send({ email: ANA.email, password: ANA.password });
    assert.equal(login.status, 403);
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookie)).body.user, null);
  });

  test('după 5 încercări greșite pe același cont, serverul răspunde 429', async () => {
    const { app, db } = makeApp();
    await addUser(db, ANA);
    const attempt = () => request(app).post('/api/auth/login').send({ email: ANA.email, password: 'gresita-123' });

    for (let i = 0; i < 5; i += 1) assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 429);
  });

  test('un antet X-Forwarded-For falsificat nu ocolește limita pe IP', async () => {
    const { app, db } = makeApp();
    await addUser(db, ANA);

    let status;
    for (let i = 0; i < 21; i += 1) {
      status = (await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `10.0.0.${i}`)
        .send({ email: `cont${i}@test.ro`, password: 'gresita-123' })).status;
    }
    assert.equal(status, 429);
  });
});
