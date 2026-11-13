import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { createEntry, findOwnEntry } from '../src/models/watchlist.js';
import { ANA, MIHAI, addFilm, addUser, loginAs, makeApp } from './helpers.js';

const today = () => new Date().toISOString().slice(0, 10);

async function setup() {
  const ctx = makeApp();
  ctx.ana = await addUser(ctx.db, ANA);
  ctx.mihai = await addUser(ctx.db, MIHAI);
  ctx.film = addFilm(ctx.db, ctx.ana, { title: 'Film comun' });
  ctx.otherFilm = addFilm(ctx.db, ctx.ana, { title: 'Alt film' });
  ctx.mihaiEntry = createEntry(ctx.db, ctx.mihai.id, {
    filmId: ctx.film.id,
    status: 'de_vazut',
    watchedOn: null,
    note: 'Notița secretă a lui Mihai',
  });
  return ctx;
}

describe('Lista mea: date private', () => {
  test('fără autentificare, toate rutele /api/me răspund 401', async () => {
    const { app, mihaiEntry } = await setup();
    const calls = [
      request(app).get('/api/me/watchlist'),
      request(app).post('/api/me/watchlist').send({ filmId: 1 }),
      request(app).put(`/api/me/watchlist/${mihaiEntry.id}`).send({ status: 'vazut' }),
      request(app).delete(`/api/me/watchlist/${mihaiEntry.id}`),
      request(app).get('/api/me/profile'),
    ];
    for (const res of await Promise.all(calls)) assert.equal(res.status, 401);
  });

  test('fiecare utilizator își vede doar propria listă', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ANA);
    const res = await agent.get('/api/me/watchlist').expect(200);

    assert.deepEqual(res.body.entries, []);
    assert.ok(!JSON.stringify(res.body).includes('Notița secretă'));
  });

  test('Ana nu poate citi, modifica sau șterge intrarea lui Mihai: primește 404, iar intrarea rămâne neschimbată', async () => {
    const { app, db, mihai, mihaiEntry } = await setup();
    const agent = await loginAs(app, ANA);

    const update = await agent.put(`/api/me/watchlist/${mihaiEntry.id}`).send({ status: 'vazut', note: 'modificat' });
    const remove = await agent.delete(`/api/me/watchlist/${mihaiEntry.id}`);
    const filtered = await agent.get(`/api/me/watchlist?film=${mihaiEntry.film_id}`).expect(200);

    assert.equal(update.status, 404);
    assert.equal(remove.status, 404);
    assert.deepEqual(filtered.body.entries, []);
    assert.equal(findOwnEntry(db, mihai.id, mihaiEntry.id).note, 'Notița secretă a lui Mihai');
  });

  test('notițele private nu apar în paginile publice ale filmului', async () => {
    const { app, film } = await setup();
    const responses = await Promise.all([
      request(app).get(`/api/films/${film.id}`),
      request(app).get(`/api/films/${film.id}/reviews`),
      request(app).get('/api/films'),
    ]);
    for (const res of responses) assert.ok(!JSON.stringify(res.body).includes('Notița secretă'));
  });
});

describe('Lista mea: adăugare și reguli', () => {
  test('adaugi un film o singură dată; filmul trebuie să existe; user_id din cerere e respins', async () => {
    const { app, film, mihai } = await setup();
    const agent = await loginAs(app, ANA);

    const created = await agent.post('/api/me/watchlist').send({ filmId: film.id }).expect(201);
    assert.equal(created.body.entry.status, 'de_vazut');

    assert.equal((await agent.post('/api/me/watchlist').send({ filmId: film.id })).status, 409);
    assert.equal((await agent.post('/api/me/watchlist').send({ filmId: 9999 })).status, 404);
    assert.equal((await agent.post('/api/me/watchlist').send({ filmId: film.id, user_id: mihai.id })).status, 400);
  });

  test('„văzut” fără dată primește data de azi; „de văzut” nu păstrează nicio dată', async () => {
    const { app, otherFilm } = await setup();
    const agent = await loginAs(app, ANA);

    const seen = await agent.post('/api/me/watchlist').send({ filmId: otherFilm.id, status: 'vazut' }).expect(201);
    assert.equal(seen.body.entry.watchedOn, today());

    const back = await agent
      .put(`/api/me/watchlist/${seen.body.entry.id}`)
      .send({ status: 'de_vazut', watchedOn: '2026-01-01', note: '' })
      .expect(200);
    assert.equal(back.body.entry.watchedOn, null);
  });

  test('datele invalide sau din viitor sunt respinse', async () => {
    const { app, otherFilm } = await setup();
    const agent = await loginAs(app, ANA);

    for (const watchedOn of ['2099-01-01', '2026-02-30', '13.11.2026', '1700-01-01']) {
      const res = await agent.post('/api/me/watchlist').send({ filmId: otherFilm.id, status: 'vazut', watchedOn });
      assert.equal(res.status, 400, watchedOn);
    }
  });
});
