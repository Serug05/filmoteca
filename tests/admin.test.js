import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { createReview } from '../src/models/reviews.js';
import { findUserById } from '../src/models/users.js';
import { ADMIN, ANA, MIHAI, addFilm, addUser, loginAs, makeApp } from './helpers.js';

const ADMIN2 = { username: 'admin2', email: 'admin2@test.ro', password: 'parola-admin2-123', role: 'admin' };

async function setup() {
  const ctx = makeApp();
  ctx.ana = await addUser(ctx.db, ANA);
  ctx.mihai = await addUser(ctx.db, MIHAI);
  ctx.admin = await addUser(ctx.db, ADMIN);
  ctx.admin2 = await addUser(ctx.db, ADMIN2);
  ctx.film = addFilm(ctx.db, ctx.ana, { title: 'Filmul Anei' });
  ctx.review = createReview(ctx.db, { filmId: ctx.film.id, userId: ctx.mihai.id, rating: 2, body: 'Recenzie de moderat' });
  return ctx;
}

const ADMIN_ROUTES = (ctx) => [
  ['get', '/api/admin/stats'],
  ['get', '/api/admin/users'],
  ['get', '/api/admin/reviews'],
  ['get', '/api/admin/log'],
  ['patch', `/api/admin/users/${ctx.mihai.id}`, { blocked: true }],
];

describe('Administrare: cine are acces', () => {
  test('un vizitator primește 401 pe toate rutele /api/admin', async () => {
    const ctx = await setup();
    for (const [method, path, body] of ADMIN_ROUTES(ctx)) {
      assert.equal((await request(ctx.app)[method](path).send(body)).status, 401, path);
    }
  });

  test('un utilizator obișnuit primește 403 pe toate rutele /api/admin și nu poate bloca pe nimeni', async () => {
    const ctx = await setup();
    const agent = await loginAs(ctx.app, ANA);
    for (const [method, path, body] of ADMIN_ROUTES(ctx)) {
      assert.equal((await agent[method](path).send(body)).status, 403, path);
    }
    assert.equal(findUserById(ctx.db, ctx.mihai.id).is_blocked, 0);
  });
});

describe('Administrare: utilizatori', () => {
  test('adminul vede utilizatorii cu email, dar fără hash-urile parolelor', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ADMIN);
    const res = await agent.get('/api/admin/users').expect(200);

    assert.equal(res.body.total, 4);
    assert.ok(res.body.users.some((user) => user.email === ANA.email));
    assert.ok(!JSON.stringify(res.body).includes('argon2'));

    const search = await agent.get('/api/admin/users').query({ q: "mihai' OR 1=1 --" }).expect(200);
    assert.equal(search.body.total, 0);
  });

  test('blocarea închide imediat sesiunile utilizatorului; deblocarea îi permite din nou să intre', async () => {
    const { app, mihai } = await setup();
    const mihaiAgent = await loginAs(app, MIHAI);
    const admin = await loginAs(app, ADMIN);

    await admin.patch(`/api/admin/users/${mihai.id}`).send({ blocked: true }).expect(200);
    assert.equal((await mihaiAgent.get('/api/auth/me')).body.user, null);
    assert.equal((await request(app).post('/api/auth/login').send({ email: MIHAI.email, password: MIHAI.password })).status, 403);

    await admin.patch(`/api/admin/users/${mihai.id}`).send({ blocked: false }).expect(200);
    await request(app).post('/api/auth/login').send({ email: MIHAI.email, password: MIHAI.password }).expect(200);
  });

  test('adminul nu se poate bloca singur, nu poate bloca alți admini și nu poate schimba roluri', async () => {
    const { app, db, admin, admin2, ana } = await setup();
    const agent = await loginAs(app, ADMIN);

    assert.equal((await agent.patch(`/api/admin/users/${admin.id}`).send({ blocked: true })).status, 400);
    assert.equal((await agent.patch(`/api/admin/users/${admin2.id}`).send({ blocked: true })).status, 403);
    assert.equal((await agent.patch(`/api/admin/users/${ana.id}`).send({ blocked: false, role: 'admin' })).status, 400);
    assert.equal((await agent.patch('/api/admin/users/9999').send({ blocked: true })).status, 404);

    assert.equal(findUserById(db, admin2.id).is_blocked, 0);
    assert.equal(findUserById(db, ana.id).role, 'user');
  });
});

describe('Administrare: raport, moderare și jurnal', () => {
  test('raportul numără corect utilizatorii, filmele și recenziile', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ADMIN);
    const { stats } = (await agent.get('/api/admin/stats').expect(200)).body;

    assert.deepEqual(stats.totals, { users: 4, admins: 2, blocked: 0, films: 1, reviews: 1, watchlistEntries: 0 });
    assert.equal(stats.topFilms[0].title, 'Filmul Anei');
  });

  test('acțiunile adminului asupra datelor altora apar în jurnal; cele asupra propriilor date nu', async () => {
    const { app, db, admin, mihai, review } = await setup();
    const agent = await loginAs(app, ADMIN);
    const ownFilm = addFilm(db, admin, { title: 'Filmul adminului' });

    await agent.patch(`/api/admin/users/${mihai.id}`).send({ blocked: true }).expect(200);
    await agent.delete(`/api/reviews/${review.id}`).expect(204);
    await agent.delete(`/api/films/${ownFilm.id}`).expect(204);

    const { entries } = (await agent.get('/api/admin/log').expect(200)).body;
    assert.deepEqual(entries.map((entry) => entry.action), ['delete_review', 'block_user']);
    assert.ok(entries.every((entry) => entry.admin === 'admin'));
  });

  test('lista de moderare arată recenziile recente cu filmul și autorul', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ADMIN);
    const res = await agent.get('/api/admin/reviews').expect(200);

    assert.equal(res.body.reviews[0].author, 'mihai');
    assert.equal(res.body.reviews[0].film.title, 'Filmul Anei');
  });
});
