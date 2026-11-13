import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { createReview, findReviewById } from '../src/models/reviews.js';
import { ADMIN, ANA, MIHAI, addFilm, addUser, loginAs, makeApp } from './helpers.js';

const REVIEW = { rating: 4, body: 'Foarte bun, aș mai vedea o dată.' };

async function setup() {
  const ctx = makeApp();
  ctx.ana = await addUser(ctx.db, ANA);
  ctx.mihai = await addUser(ctx.db, MIHAI);
  ctx.film = addFilm(ctx.db, ctx.ana, { title: 'Film recenzat' });
  ctx.mihaiReview = createReview(ctx.db, { filmId: ctx.film.id, userId: ctx.mihai.id, rating: 3, body: 'Recenzia lui Mihai' });
  return ctx;
}

describe('Recenzii: citire și scriere', () => {
  test('oricine vede recenziile, iar despre autor apar doar id-ul și numele', async () => {
    const { app, film } = await setup();
    const res = await request(app).get(`/api/films/${film.id}/reviews`).expect(200);

    assert.equal(res.body.reviews.length, 1);
    assert.deepEqual(Object.keys(res.body.reviews[0].author).sort(), ['id', 'username']);
    assert.ok(!JSON.stringify(res.body).includes(MIHAI.email));
  });

  test('media și numărul recenziilor apar la film', async () => {
    const { app, db, film, ana } = await setup();
    createReview(db, { filmId: film.id, userId: ana.id, rating: 5, body: 'Excelent' });

    const res = await request(app).get(`/api/films/${film.id}`).expect(200);
    assert.deepEqual(res.body.film.rating, { average: 4, count: 2 });
  });

  test('un vizitator neautentificat nu poate scrie recenzii', async () => {
    const { app, film } = await setup();
    assert.equal((await request(app).post(`/api/films/${film.id}/reviews`).send(REVIEW)).status, 401);
  });

  test('autorul e cel autentificat; a doua recenzie la același film e respinsă (409)', async () => {
    const { app, film, ana } = await setup();
    const agent = await loginAs(app, ANA);

    const created = await agent.post(`/api/films/${film.id}/reviews`).send(REVIEW).expect(201);
    assert.equal(created.body.review.author.id, ana.id);

    assert.equal((await agent.post(`/api/films/${film.id}/reviews`).send(REVIEW)).status, 409);
  });

  test('serverul validează nota și textul și respinge câmpuri în plus (user_id)', async () => {
    const { app, film, mihai } = await setup();
    const agent = await loginAs(app, ANA);
    const invalid = [
      { rating: 0, body: 'text bun' },
      { rating: 6, body: 'text bun' },
      { rating: 2.5, body: 'text bun' },
      { rating: '5', body: 'text bun' },
      { rating: 4, body: '  ' },
      { ...REVIEW, user_id: mihai.id },
    ];

    for (const body of invalid) {
      assert.equal((await agent.post(`/api/films/${film.id}/reviews`).send(body)).status, 400, JSON.stringify(body));
    }
  });

  test('recenzia la un film inexistent primește 404', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ANA);
    assert.equal((await agent.post('/api/films/9999/reviews').send(REVIEW)).status, 404);
  });
});

describe('Recenzii: controlul accesului', () => {
  test('Ana primește 403 când editează sau șterge recenzia lui Mihai, iar recenzia rămâne neschimbată', async () => {
    const { app, db, mihaiReview } = await setup();
    const agent = await loginAs(app, ANA);

    assert.equal((await agent.put(`/api/reviews/${mihaiReview.id}`).send(REVIEW)).status, 403);
    assert.equal((await agent.delete(`/api/reviews/${mihaiReview.id}`)).status, 403);
    assert.equal(findReviewById(db, mihaiReview.id).body, 'Recenzia lui Mihai');
  });

  test('autorul își poate edita și șterge recenzia', async () => {
    const { app, db, mihaiReview } = await setup();
    const agent = await loginAs(app, MIHAI);

    const edited = await agent.put(`/api/reviews/${mihaiReview.id}`).send(REVIEW).expect(200);
    assert.equal(edited.body.review.body, REVIEW.body);

    await agent.delete(`/api/reviews/${mihaiReview.id}`).expect(204);
    assert.equal(findReviewById(db, mihaiReview.id), undefined);
  });

  test('adminul poate șterge orice recenzie, dar nu poate scrie în numele altcuiva', async () => {
    const { app, db, mihaiReview } = await setup();
    await addUser(db, ADMIN);
    const agent = await loginAs(app, ADMIN);

    assert.equal((await agent.put(`/api/reviews/${mihaiReview.id}`).send(REVIEW)).status, 403);
    await agent.delete(`/api/reviews/${mihaiReview.id}`).expect(204);
  });
});
