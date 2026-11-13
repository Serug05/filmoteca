import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import sharp from 'sharp';
import request from 'supertest';
import { ANA, MIHAI, addFilm, addUser, loginAs, makeApp } from './helpers.js';

const POSTER_URL = /^\/uploads\/posters\/[0-9a-f-]{36}\.webp$/;

function makeImage(format, extra = (image) => image) {
  return extra(sharp({ create: { width: 40, height: 60, channels: 3, background: '#f2a93b' } }))[format]().toBuffer();
}

async function setup() {
  const ctx = makeApp();
  ctx.ana = await addUser(ctx.db, ANA);
  ctx.mihai = await addUser(ctx.db, MIHAI);
  ctx.anaFilm = addFilm(ctx.db, ctx.ana, { title: 'Filmul Anei' });
  ctx.mihaiFilm = addFilm(ctx.db, ctx.mihai, { title: 'Filmul lui Mihai' });
  ctx.agent = await loginAs(ctx.app, ANA);
  return ctx;
}

const filesIn = (dir) => fs.readdirSync(dir);

describe('Încărcarea posterelor', () => {
  test('o imagine validă devine WebP cu nume aleator, iar numele trimis („../../”) e ignorat', async () => {
    const { app, agent, anaFilm, postersDir } = await setup();
    const res = await agent
      .post(`/api/films/${anaFilm.id}/poster`)
      .attach('poster', await makeImage('png'), { filename: '../../../server.js', contentType: 'image/png' })
      .expect(200);

    assert.match(res.body.film.posterUrl, POSTER_URL);
    assert.deepEqual(filesIn(postersDir), [path.basename(res.body.film.posterUrl)]);

    const served = await request(app).get(res.body.film.posterUrl).expect(200);
    assert.equal(served.headers['content-type'], 'image/webp');
    assert.equal(served.headers['x-content-type-options'], 'nosniff');
  });

  test('metadatele pozei (EXIF, de ex. locația GPS) sunt șterse', async () => {
    const { agent, anaFilm, postersDir } = await setup();
    const withExif = await makeImage('jpeg', (image) => image.withExif({ IFD0: { Copyright: 'GPS 44.43 26.10' } }));
    assert.ok((await sharp(withExif).metadata()).exif);

    const res = await agent.post(`/api/films/${anaFilm.id}/poster`).attach('poster', withExif, 'poza.jpg').expect(200);
    const stored = fs.readFileSync(path.join(postersDir, path.basename(res.body.film.posterUrl)));

    assert.equal((await sharp(stored).metadata()).exif, undefined);
  });

  test('fișierele care nu sunt imagini JPG/PNG/WebP reale sunt respinse, chiar dacă pretind că sunt', async () => {
    const { agent, anaFilm, postersDir } = await setup();
    const fakes = [
      [Buffer.from('<script>alert(1)</script>'), 'poster.png', 'image/png'],
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'poster.svg', 'image/svg+xml'],
      [Buffer.from('<html><body>pagina</body></html>'), 'poster.html', 'text/html'],
      [await makeImage('gif'), 'poster.gif', 'image/gif'],
    ];

    for (const [content, filename, contentType] of fakes) {
      const res = await agent.post(`/api/films/${anaFilm.id}/poster`).attach('poster', content, { filename, contentType });
      assert.equal(res.status, 400, filename);
    }
    assert.deepEqual(filesIn(postersDir), []);
  });

  test('un fișier mai mare de 2 MB este respins cu 413', async () => {
    const { agent, anaFilm, postersDir } = await setup();
    const res = await agent
      .post(`/api/films/${anaFilm.id}/poster`)
      .attach('poster', Buffer.alloc(2 * 1024 * 1024 + 1), 'mare.png');

    assert.equal(res.status, 413);
    assert.deepEqual(filesIn(postersDir), []);
  });

  test('Ana primește 403 când încarcă un poster pe filmul lui Mihai și nimic nu se salvează', async () => {
    const { agent, mihaiFilm, postersDir } = await setup();
    const res = await agent.post(`/api/films/${mihaiFilm.id}/poster`).attach('poster', await makeImage('png'), 'p.png');

    assert.equal(res.status, 403);
    assert.deepEqual(filesIn(postersDir), []);
  });

  test('înlocuirea posterului sau ștergerea filmului șterge și fișierul vechi', async () => {
    const { agent, anaFilm, postersDir } = await setup();
    const upload = async () =>
      (await agent.post(`/api/films/${anaFilm.id}/poster`).attach('poster', await makeImage('png'), 'p.png').expect(200)).body.film;

    await upload();
    const second = await upload();
    assert.deepEqual(filesIn(postersDir), [path.basename(second.posterUrl)]);

    await agent.delete(`/api/films/${anaFilm.id}`).expect(204);
    assert.deepEqual(filesIn(postersDir), []);
  });
});
