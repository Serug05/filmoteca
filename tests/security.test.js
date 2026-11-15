import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import request from 'supertest';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { makeApp } from './helpers.js';

const ANA = { username: 'ana', email: 'ana@test.ro', password: 'parola-sigura-123' };

function fakeResponse() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function runMiddleware(middleware, user) {
  const res = fakeResponse();
  let passed = false;
  middleware({ user }, res, () => {
    passed = true;
  });
  return { passed, status: res.statusCode };
}

describe('Controlul accesului', () => {
  test('requireAuth: 401 fără sesiune, trece cu sesiune', () => {
    assert.deepEqual(runMiddleware(requireAuth, null), { passed: false, status: 401 });
    assert.equal(runMiddleware(requireAuth, { id: 1, role: 'user' }).passed, true);
  });

  test('requireRole("admin"): un utilizator obișnuit primește 403, adminul trece', () => {
    const adminOnly = requireRole('admin');
    assert.deepEqual(runMiddleware(adminOnly, null), { passed: false, status: 401 });
    assert.deepEqual(runMiddleware(adminOnly, { id: 1, role: 'user' }), { passed: false, status: 403 });
    assert.equal(runMiddleware(adminOnly, { id: 2, role: 'admin' }).passed, true);
  });
});

describe('Protecții generale', () => {
  test('cererile care modifică date, venite de pe alt site, sunt blocate (CSRF)', async () => {
    const { app } = makeApp();

    const fromOtherOrigin = await request(app).post('/api/auth/register').set('Origin', 'https://atacator.example').send(ANA);
    const crossSite = await request(app).post('/api/auth/register').set('Sec-Fetch-Site', 'cross-site').send(ANA);
    const sameOrigin = await request(app).post('/api/auth/register').set('Sec-Fetch-Site', 'same-origin').send(ANA);

    assert.equal(fromOtherOrigin.status, 403);
    assert.equal(crossSite.status, 403);
    assert.equal(sameOrigin.status, 201);
  });

  test('antetele de securitate sunt prezente pe pagini și pe API', async () => {
    const { app } = makeApp();

    for (const path of ['/', '/api/auth/me']) {
      const res = await request(app).get(path);
      const csp = res.headers['content-security-policy'];
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /script-src 'self'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-powered-by'], undefined);
      assert.match(res.headers['permissions-policy'], /camera=\(\)/);
    }
  });

  test('un JSON invalid primește 400, fără detalii interne', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Corpul cererii nu este JSON valid.' });
  });

  test('din Three.js se servesc doar cele două fișiere necesare, nimic altceva din node_modules', async () => {
    const { app } = makeApp();

    const module = await request(app).get('/vendor/three/three.module.js').expect(200);
    assert.match(module.headers['content-type'], /javascript/);

    for (const path of ['/vendor/three/three.cjs', '/vendor/three/..%2Fpackage.json', '/vendor/three/%2e%2e%2f%2e%2e%2f.env', '/vendor/three/']) {
      assert.equal((await request(app).get(path)).status, 404, path);
    }
  });

  test('rutele API necunoscute răspund cu 404 JSON, iar fișierele din afara public/ nu sunt servite', async () => {
    const { app } = makeApp();

    const unknown = await request(app).get('/api/nu-exista');
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.body, { error: 'Resursa nu există.' });

    for (const path of ['/.env', '/package.json', '/src/app.js', '/data/filme.db', '/%2e%2e/.env', '/uploads/posters/../../.env']) {
      const res = await request(app).get(path);
      assert.equal(res.status, 404, path);
      assert.match(res.text, /Pagina nu există/, path);
    }
  });
});
