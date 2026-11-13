import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { findFilmById } from '../src/models/films.js';
import { ADMIN, ANA, MIHAI, addFilm, addUser, loginAs, makeApp } from './helpers.js';

const NEW_FILM = { title: 'Arrival', year: 2016, genre: 'sf', description: 'Contact cu o civilizație extraterestră.' };

async function setup() {
  const ctx = makeApp();
  ctx.ana = await addUser(ctx.db, ANA);
  ctx.mihai = await addUser(ctx.db, MIHAI);
  ctx.mihaiFilm = addFilm(ctx.db, ctx.mihai, { title: 'Filmul lui Mihai' });
  return ctx;
}

describe('Catalogul public', () => {
  test('oricine vede lista și detaliile, fără date private despre proprietar', async () => {
    const { app, mihaiFilm } = await setup();

    const list = await request(app).get('/api/films').expect(200);
    assert.equal(list.body.total, 1);
    assert.deepEqual(Object.keys(list.body.films[0].owner).sort(), ['id', 'username']);
    assert.ok(!JSON.stringify(list.body).includes(MIHAI.email));

    const detail = await request(app).get(`/api/films/${mihaiFilm.id}`).expect(200);
    assert.equal(detail.body.film.title, 'Filmul lui Mihai');
  });

  test('id-urile invalide sau inexistente din URL primesc 404', async () => {
    const { app } = await setup();
    for (const id of ['abc', '0', '-1', '1.5', '01', '1e3', '99999']) {
      assert.equal((await request(app).get(`/api/films/${id}`)).status, 404, id);
    }
  });

  test('paginarea acceptă doar pagini valide', async () => {
    const { app } = await setup();
    assert.equal((await request(app).get('/api/films?page=0')).status, 400);
    assert.equal((await request(app).get('/api/films?page=abc')).status, 400);
    assert.equal((await request(app).get('/api/films?page=2')).status, 200);
  });
});

describe('Adăugare și validare', () => {
  test('un vizitator neautentificat nu poate adăuga filme', async () => {
    const { app } = await setup();
    assert.equal((await request(app).post('/api/films').send(NEW_FILM)).status, 401);
  });

  test('filmul nou aparține celui autentificat; un owner_id trimis de client este respins', async () => {
    const { app, ana, mihai } = await setup();
    const agent = await loginAs(app, ANA);

    const forged = await agent.post('/api/films').send({ ...NEW_FILM, owner_id: mihai.id });
    assert.equal(forged.status, 400);

    const created = await agent.post('/api/films').send(NEW_FILM).expect(201);
    assert.equal(created.body.film.owner.id, ana.id);
  });

  test('serverul validează titlul, anul și genul', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ANA);
    const res = await agent.post('/api/films').send({ title: '   ', year: 1500, genre: 'telenovela' });

    assert.equal(res.status, 400);
    assert.ok(res.body.fields.title);
    assert.ok(res.body.fields.year);
    assert.ok(res.body.fields.genre);
  });

  test('textele cu caractere invizibile sau care inversează direcția textului sunt respinse', async () => {
    const { app } = await setup();
    const agent = await loginAs(app, ANA);
    for (const title of ['Film‮gnp.exe', 'Film\u0000ascuns', 'Film⁦x⁩']) {
      assert.equal((await agent.post('/api/films').send({ ...NEW_FILM, title })).status, 400, JSON.stringify(title));
    }
  });
});

describe('Controlul accesului pe filme', () => {
  test('Ana primește 403 când editează filmul lui Mihai, iar filmul rămâne neschimbat', async () => {
    const { app, db, mihaiFilm } = await setup();
    const agent = await loginAs(app, ANA);

    const res = await agent.put(`/api/films/${mihaiFilm.id}`).send({ ...NEW_FILM, title: 'Modificat de Ana' });

    assert.equal(res.status, 403);
    assert.equal(findFilmById(db, mihaiFilm.id).title, 'Filmul lui Mihai');
  });

  test('Ana primește 403 când șterge filmul lui Mihai, iar filmul rămâne în catalog', async () => {
    const { app, db, mihaiFilm } = await setup();
    const agent = await loginAs(app, ANA);

    assert.equal((await agent.delete(`/api/films/${mihaiFilm.id}`)).status, 403);
    assert.ok(findFilmById(db, mihaiFilm.id));
  });

  test('proprietarul își poate edita și șterge propriul film', async () => {
    const { app, db, mihaiFilm } = await setup();
    const agent = await loginAs(app, MIHAI);

    const edited = await agent.put(`/api/films/${mihaiFilm.id}`).send(NEW_FILM).expect(200);
    assert.equal(edited.body.film.title, 'Arrival');

    await agent.delete(`/api/films/${mihaiFilm.id}`).expect(204);
    assert.equal(findFilmById(db, mihaiFilm.id), undefined);
  });

  test('proprietarul nu poate șterge un film pe care alți utilizatori l-au recenzat sau salvat', async () => {
    const { app, db, ana, mihai } = await setup();
    const reviewed = addFilm(db, mihai, { title: 'Recenzat de Ana' });
    const saved = addFilm(db, mihai, { title: 'Salvat de Ana' });
    db.prepare('INSERT INTO reviews (film_id, user_id, rating, body) VALUES (?, ?, 5, ?)').run(reviewed.id, ana.id, 'Bun');
    db.prepare('INSERT INTO watchlist (user_id, film_id) VALUES (?, ?)').run(ana.id, saved.id);
    const agent = await loginAs(app, MIHAI);

    assert.equal((await agent.delete(`/api/films/${reviewed.id}`)).status, 409);
    assert.equal((await agent.delete(`/api/films/${saved.id}`)).status, 409);
    assert.ok(findFilmById(db, reviewed.id));
    assert.ok(findFilmById(db, saved.id));
  });

  test('adminul poate edita și șterge orice film', async () => {
    const { app, db, ana, mihaiFilm } = await setup();
    await addUser(db, ADMIN);
    db.prepare('INSERT INTO reviews (film_id, user_id, rating, body) VALUES (?, ?, 4, ?)').run(mihaiFilm.id, ana.id, 'Ok');
    const agent = await loginAs(app, ADMIN);

    await agent.put(`/api/films/${mihaiFilm.id}`).send(NEW_FILM).expect(200);
    await agent.delete(`/api/films/${mihaiFilm.id}`).expect(204);
    assert.equal(findFilmById(db, mihaiFilm.id), undefined);
  });
});
