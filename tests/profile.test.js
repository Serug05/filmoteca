import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { findUserById } from '../src/models/users.js';
import { ANA, MIHAI, addUser, loginAs, makeApp } from './helpers.js';

async function setup() {
  const ctx = makeApp();
  ctx.ana = await addUser(ctx.db, ANA);
  ctx.mihai = await addUser(ctx.db, MIHAI);
  return ctx;
}

describe('Profil', () => {
  test('profilul arată propriul email și statistici, fără hash-ul parolei', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ANA);
    const res = await agent.get('/api/me/profile').expect(200);

    assert.equal(res.body.profile.email, ANA.email);
    assert.deepEqual(res.body.profile.stats, { films: 0, reviews: 0, watchlist: 0 });
    assert.ok(!JSON.stringify(res.body).includes('argon2'));
  });

  test('schimbarea emailului cere parola actuală corectă', async () => {
    const { app, db, ana } = await setup();
    const agent = await loginAs(app, ANA);

    const wrong = await agent.put('/api/me/profile').send({ email: 'nou@test.ro', currentPassword: 'gresita-123' });
    assert.equal(wrong.status, 400);
    assert.equal(findUserById(db, ana.id).email, ANA.email);

    const taken = await agent.put('/api/me/profile').send({ email: MIHAI.email, currentPassword: ANA.password });
    assert.equal(taken.status, 409);

    const ok = await agent.put('/api/me/profile').send({ email: 'Nou@Test.ro', currentPassword: ANA.password }).expect(200);
    assert.equal(ok.body.profile.email, 'nou@test.ro');
  });

  test('rolul sau numele nu pot fi schimbate din profil', async () => {
    const { app, db, ana } = await setup();
    const agent = await loginAs(app, ANA);

    const res = await agent.put('/api/me/profile').send({ email: ANA.email, currentPassword: ANA.password, role: 'admin' });
    assert.equal(res.status, 400);
    assert.equal(findUserById(db, ana.id).role, 'user');
  });

  test('schimbarea parolei: parola veche nu mai merge, iar celelalte sesiuni se închid', async () => {
    const { app } = await setup();
    const phone = await loginAs(app, ANA);
    const laptop = await loginAs(app, ANA);
    const newPassword = 'parola-noua-ana-456';

    const wrong = await laptop.put('/api/me/password').send({ currentPassword: 'gresita-123', newPassword });
    assert.equal(wrong.status, 400);

    await laptop.put('/api/me/password').send({ currentPassword: ANA.password, newPassword }).expect(204);

    assert.equal((await laptop.get('/api/auth/me')).body.user.username, 'ana');
    assert.equal((await phone.get('/api/auth/me')).body.user, null);
    assert.equal((await request(app).post('/api/auth/login').send({ email: ANA.email, password: ANA.password })).status, 401);
    await request(app).post('/api/auth/login').send({ email: ANA.email, password: newPassword }).expect(200);
  });

  test('după 10 încercări greșite ale parolei actuale, serverul răspunde 429', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ANA);
    const attempt = () => agent.put('/api/me/password').send({ currentPassword: 'gresita-123', newPassword: 'parola-noua-789' });

    for (let i = 0; i < 10; i += 1) assert.equal((await attempt()).status, 400);
    assert.equal((await attempt()).status, 429);
  });
});
