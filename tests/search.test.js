import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { createReview } from '../src/models/reviews.js';
import { ANA, MIHAI, addFilm, addUser, makeApp } from './helpers.js';

async function setup() {
  const ctx = makeApp();
  const ana = await addUser(ctx.db, ANA);
  const mihai = await addUser(ctx.db, MIHAI);
  const films = {
    lazarescu: addFilm(ctx.db, ana, { title: 'Moartea domnului Lăzărescu', genre: 'drama', year: 2005 }),
    fratia: addFilm(ctx.db, ana, { title: 'Frăția inelului', genre: 'fantasy', year: 2001 }),
    inception: addFilm(ctx.db, ana, { title: 'Inception', genre: 'sf', year: 2010 }),
    procent: addFilm(ctx.db, ana, { title: '100% Wolf', genre: 'animatie', year: 2020 }),
  };
  createReview(ctx.db, { filmId: films.inception.id, userId: ana.id, rating: 5, body: 'Super' });
  createReview(ctx.db, { filmId: films.inception.id, userId: mihai.id, rating: 4, body: 'Bun' });
  createReview(ctx.db, { filmId: films.fratia.id, userId: mihai.id, rating: 3, body: 'Ok' });
  return { ...ctx, films };
}

const titles = (res) => res.body.films.map((film) => film.title);

describe('Căutare, filtrare și sortare', () => {
  test('căutarea ignoră majusculele și diacriticele', async () => {
    const { app } = await setup();
    assert.deepEqual(titles(await request(app).get('/api/films?q=lazarescu')), ['Moartea domnului Lăzărescu']);
    assert.deepEqual(titles(await request(app).get('/api/films?q=FRATIA')), ['Frăția inelului']);
  });

  test('încercările de injecție SQL sunt tratate ca text obișnuit', async () => {
    const { app } = await setup();
    for (const q of ["' OR 1=1 --", '_', "x' UNION SELECT email, password_hash FROM users --"]) {
      const res = await request(app).get('/api/films').query({ q });
      assert.equal(res.status, 200, q);
      assert.equal(res.body.total, 0, q);
    }
    // „%” e căutat ca simplu caracter, nu ca „orice text”: găsește doar titlul care îl conține.
    assert.deepEqual(titles(await request(app).get('/api/films').query({ q: '%' })), ['100% Wolf']);
  });

  test('filtrul pe gen acceptă doar genuri din listă', async () => {
    const { app } = await setup();
    assert.deepEqual(titles(await request(app).get('/api/films?genre=sf')), ['Inception']);
    assert.equal((await request(app).get('/api/films?genre=telenovela')).status, 400);
    assert.equal((await request(app).get('/api/films?genre=')).body.total, 4);
  });

  test('sortarea după notă și după an', async () => {
    const { app } = await setup();
    const byRating = titles(await request(app).get('/api/films?sort=rating'));
    assert.deepEqual(byRating.slice(0, 2), ['Inception', 'Frăția inelului']);

    const byYear = titles(await request(app).get('/api/films?sort=year'));
    assert.deepEqual(byYear, ['100% Wolf', 'Inception', 'Moartea domnului Lăzărescu', 'Frăția inelului']);
  });

  test('o ordine de sortare necunoscută sau parametri trimiși ca listă sunt respinși', async () => {
    const { app } = await setup();
    for (const query of ['sort=title;DROP TABLE films', 'sort=f.id', 'genre=sf&genre=drama', 'q=a&q=b', 'page=1&page=2']) {
      assert.equal((await request(app).get(`/api/films?${query}`)).status, 400, query);
    }
  });
});
