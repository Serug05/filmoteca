import { loadEnvFile } from '../src/config.js';

// Atac automat asupra aplicației PORNITE: încearcă pe rând ce ar încerca agenții AI
// (escaladare de privilegii, IDOR, injecții, XSS, fișiere malițioase, CSRF, sesiuni, forță brută)
// și raportează orice răspuns neașteptat.
//
// Rulare: npm run attack -- http://localhost:3000
// Atenție: creează date de test (un cont „atacator-…”, filme cu text ciudat). Folosește o instanță
// separată sau rulează `npm run seed` după.

loadEnvFile();
const BASE = process.argv[2] ?? 'http://localhost:3000';
const ADMIN_PW = process.env.SEED_ADMIN_PASSWORD;
const USER_PW = process.env.SEED_USER_PASSWORD;
const RUN = Math.random().toString(36).slice(2, 8);

const findings = [];
const passed = [];
function check(name, ok, detail = '') {
  (ok ? passed : findings).push(detail ? `${name} — ${detail}` : name);
}

class Client {
  constructor(name) { this.name = name; this.cookie = ''; }
  async req(method, path, { json, body, headers = {} } = {}) {
    const h = { ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    let payload = body;
    if (json !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(json); }
    const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(';');
      if (pair.startsWith('sid=')) this.cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* nu e JSON */ }
    return { status: res.status, data, text, headers: res.headers };
  }
  async login(email, password) {
    const r = await this.req('POST', '/api/auth/login', { json: { email, password } });
    if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
    this.user = r.data.user;
    return this;
  }
}

const guest = new Client('vizitator');
const ana = await new Client('ana').login('ana@filme.test', USER_PW);
const admin = await new Client('admin').login('admin@filme.test', ADMIN_PW);

// Un atacator nou, cu cont propriu (cum ar face agenții).
const evil = new Client('atacator');
const EVIL_EMAIL = `atacator-${RUN}@evil.test`;
const reg = await evil.req('POST', '/api/auth/register', { json: { username: `atacator-${RUN}`, email: EVIL_EMAIL, password: 'parola-atacator-1' } });
check('Înregistrare atacator', reg.status === 201, `status ${reg.status}`);

// ---------- 1. Escaladarea privilegiilor ----------
for (const extra of [{ role: 'admin' }, { isAdmin: true }, { is_blocked: 0, role: 'admin' }]) {
  const r = await guest.req('POST', '/api/auth/register', { json: { username: `x${Math.random().toString(36).slice(2, 8)}`, email: `${Math.random().toString(36).slice(2, 8)}@e.test`, password: 'parola-lunga-123', ...extra } });
  check(`Mass assignment la înregistrare ${JSON.stringify(extra)}`, r.status === 400, `status ${r.status}`);
}
const adminRoutes = [['GET', '/api/admin/stats'], ['GET', '/api/admin/users'], ['GET', '/api/admin/log'], ['GET', '/api/admin/reviews'], ['PATCH', `/api/admin/users/${ana.user.id}`, { blocked: true }]];
for (const [m, p, j] of adminRoutes) {
  const r = await evil.req(m, p, { json: j });
  check(`User normal pe ${m} ${p}`, r.status === 403, `status ${r.status}`);
  const g = await guest.req(m, p, { json: j });
  check(`Vizitator pe ${m} ${p}`, g.status === 401, `status ${g.status}`);
}
const roleChange = await evil.req('PUT', '/api/me/profile', { json: { email: EVIL_EMAIL, currentPassword: 'parola-atacator-1', role: 'admin' } });
check('Schimbarea rolului din profil', roleChange.status === 400, `status ${roleChange.status}`);
const me = await evil.req('GET', '/api/auth/me');
check('Atacatorul a rămas user', me.data?.user?.role === 'user', JSON.stringify(me.data?.user));

// ---------- 2. IDOR pe filme, recenzii, liste ----------
const films = (await guest.req('GET', '/api/films?page=1')).data.films;
const anaFilm = films.find((f) => f.owner.username === 'ana') ?? (await guest.req('GET', '/api/films?page=2')).data.films.find((f) => f.owner.username === 'ana');
const r1 = await evil.req('PUT', `/api/films/${anaFilm.id}`, { json: { title: 'PWNED', year: 2000, genre: 'drama', description: '' } });
check('IDOR: editarea filmului Anei', r1.status === 403, `status ${r1.status}`);
const r2 = await evil.req('DELETE', `/api/films/${anaFilm.id}`);
check('IDOR: ștergerea filmului Anei', r2.status === 403, `status ${r2.status}`);
const r3 = await evil.req('POST', `/api/films/${anaFilm.id}/poster`, { body: (() => { const f = new FormData(); f.append('poster', new Blob([Buffer.from('x')], { type: 'image/png' }), 'a.png'); return f; })() });
check('IDOR: poster pe filmul Anei', r3.status === 403, `status ${r3.status}`);
const after = (await guest.req('GET', `/api/films/${anaFilm.id}`)).data.film;
check('Filmul Anei neschimbat', after.title === anaFilm.title, after.title);

const reviews = (await guest.req('GET', `/api/films/${anaFilm.id}/reviews`)).data.reviews;
const someoneReview = reviews.find((r) => !r.author.username.startsWith('atacator-'));
if (someoneReview) {
  const p = await evil.req('PUT', `/api/reviews/${someoneReview.id}`, { json: { rating: 1, body: 'PWNED' } });
  check('IDOR: editarea recenziei altcuiva', p.status === 403, `status ${p.status}`);
  const d = await evil.req('DELETE', `/api/reviews/${someoneReview.id}`);
  check('IDOR: ștergerea recenziei altcuiva', d.status === 403, `status ${d.status}`);
  const a = await admin.req('PUT', `/api/reviews/${someoneReview.id}`, { json: { rating: 1, body: 'scris de admin' } });
  check('Adminul nu poate scrie în numele altcuiva', a.status === 403, `status ${a.status}`);
}

// Lista privată: încercăm toate id-urile 1..40.
let leaked = 0;
for (let id = 1; id <= 40; id++) {
  const put = await evil.req('PUT', `/api/me/watchlist/${id}`, { json: { status: 'vazut', note: 'PWNED' } });
  const del = await evil.req('DELETE', `/api/me/watchlist/${id}`);
  if (put.status !== 404 || del.status !== 404) leaked++;
}
check('IDOR: listele private ale altora (id 1..40)', leaked === 0, `${leaked} id-uri au răspuns altfel decât 404`);
const anaList = (await ana.req('GET', '/api/me/watchlist')).data.entries;
check('Lista Anei neatinsă', anaList.every((e) => e.note !== 'PWNED'), `${anaList.length} intrări`);
const filmFilter = await evil.req('GET', `/api/me/watchlist?film=${anaList[0]?.film.id}`);
check('Filtrul ?film= arată doar lista proprie', filmFilter.data.entries.length === 0, JSON.stringify(filmFilter.data));
const forgedOwner = await evil.req('POST', '/api/me/watchlist', { json: { filmId: anaFilm.id, user_id: ana.user.id } });
check('Mass assignment user_id la listă', forgedOwner.status === 400, `status ${forgedOwner.status}`);
const forgedReview = await evil.req('POST', `/api/films/${anaFilm.id}/reviews`, { json: { rating: 5, body: 'text bun', user_id: ana.user.id } });
check('Mass assignment user_id la recenzie', forgedReview.status === 400, `status ${forgedReview.status}`);
const forgedFilm = await evil.req('POST', '/api/films', { json: { title: 'X', year: 2000, genre: 'drama', owner_id: ana.user.id } });
check('Mass assignment owner_id la film', forgedFilm.status === 400, `status ${forgedFilm.status}`);

// ---------- 3. Expunerea datelor private ----------
const publicResponses = [];
for (let page = 1; page <= 3; page++) publicResponses.push((await guest.req('GET', `/api/films?page=${page}`)).text);
for (const f of films) {
  publicResponses.push((await guest.req('GET', `/api/films/${f.id}`)).text);
  publicResponses.push((await guest.req('GET', `/api/films/${f.id}/reviews`)).text);
}
publicResponses.push((await evil.req('GET', '/api/genres')).text);
const blob = publicResponses.join('\n');
check('Fără emailuri în răspunsurile publice', !/@filme\.test/.test(blob));
check('Fără hash-uri de parolă', !/argon2/.test(blob));
check('Fără notițe private în răspunsurile publice', !/cinematograful din cartier|colega de birou|Halloween acasă/.test(blob));
const evilMe = await evil.req('GET', '/api/me/profile');
check('Profilul propriu nu conține hash', !/argon2|password/.test(evilMe.text));

// ---------- 4. Injecții ----------
const injections = ["' OR '1'='1", "' OR 1=1 --", "\" OR \"\"=\"", "') UNION SELECT email, password_hash, 1,1,1,1,1,1,1,1,1 FROM users --", '%', '_', '\\', "'; DROP TABLE films; --", '{"$ne":null}'];
for (const q of injections) {
  const r = await guest.req('GET', `/api/films?q=${encodeURIComponent(q)}`);
  const leak = /@|argon2/.test(r.text);
  check(`SQLi în căutare: ${q}`, r.status === 200 && !leak && r.data.total <= 1, `status ${r.status}, total ${r.data?.total}`);
}
for (const s of ["rating; DROP TABLE films", 'f.id', '(SELECT 1)', 'title DESC', '']) {
  const r = await guest.req('GET', `/api/films?sort=${encodeURIComponent(s)}`);
  check(`Injecție în sort: "${s}"`, s === '' ? r.status === 200 : r.status === 400, `status ${r.status}`);
}
for (const q of ['genre[$ne]=x', 'q[$gt]=', 'page[]=1', 'genre=sf&genre=drama', 'page=-1', 'page=1e3', 'page=99999999999999999999']) {
  const r = await guest.req('GET', `/api/films?${q}`);
  check(`Parametri ciudați: ${q}`, r.status === 200 || r.status === 400, `status ${r.status}`);
  check(`Fără eroare 500: ${q}`, r.status !== 500);
}
const adminSearch = await admin.req('GET', `/api/admin/users?q=${encodeURIComponent("' OR 1=1 --")}`);
check('SQLi în căutarea adminului', adminSearch.status === 200 && adminSearch.data.total === 0, `total ${adminSearch.data?.total}`);
for (const body of [{ email: { $ne: null }, password: { $ne: null } }, { email: 'ana@filme.test', password: { $gt: '' } }, { email: ["ana@filme.test"], password: 'x' }, { email: "ana@filme.test' --", password: 'x' }]) {
  const r = await guest.req('POST', '/api/auth/login', { json: body });
  check(`Injecție la login ${JSON.stringify(body)}`, r.status === 400 || r.status === 401, `status ${r.status}`);
}

// ---------- 5. XSS ----------
const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>"\'><svg onload=alert(3)>';
const film = await evil.req('POST', '/api/films', { json: { title: xss.slice(0, 120), year: 2020, genre: 'drama', description: xss } });
check('Film cu payload XSS acceptat ca text', film.status === 201, `status ${film.status}`);
const fj = await guest.req('GET', `/api/films/${film.data.film.id}`);
check('API-ul răspunde JSON, nu HTML', (fj.headers.get('content-type') ?? '').includes('application/json'));
check('nosniff pe API', fj.headers.get('x-content-type-options') === 'nosniff');
const page = await guest.req('GET', `/film.html?id=${film.data.film.id}`);
check('Pagina HTML nu include datele din server (randare doar prin textContent)', !page.text.includes('onerror=alert'));
const csp = page.headers.get('content-security-policy') ?? '';
check('CSP fără unsafe-inline / unsafe-eval', /script-src 'self'/.test(csp) && !/unsafe/.test(csp), csp);
const reflected = await guest.req('GET', `/?q=${encodeURIComponent('<script>alert(1)</script>')}`);
check('Fără XSS reflectat în pagina de catalog', !reflected.text.includes('<script>alert(1)</script>'));
const nf = await guest.req('GET', `/${encodeURIComponent('<script>alert(1)</script>')}`);
check('Fără XSS reflectat în pagina 404', nf.status === 404 && !nf.text.includes('<script>alert(1)</script>'));
const badUser = await guest.req('POST', '/api/auth/register', { json: { username: '<script>', email: 'x1@e.test', password: 'parola-lunga-123' } });
check('Username cu HTML respins', badUser.status === 400, `status ${badUser.status}`);

// ---------- 6. Încărcări de fișiere ----------
async function upload(client, filmId, buffer, filename, type) {
  const form = new FormData();
  form.append('poster', new Blob([buffer], { type }), filename);
  return client.req('POST', `/api/films/${filmId}/poster`, { body: form });
}
const evilFilmId = film.data.film.id;
const uploads = [
  [Buffer.from('<html><script>alert(1)</script></html>'), 'x.html', 'text/html'],
  [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'image/svg+xml'],
  [Buffer.from('<?php system($_GET["c"]); ?>'), 'shell.php.png', 'image/png'],
  [Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('<script>alert(1)</script>')]), 'magic.png', 'image/png'],
  [Buffer.from('GIF89a<script>alert(1)</script>'), 'x.gif', 'image/gif'],
];
for (const [buf, name, type] of uploads) {
  const r = await upload(evil, evilFilmId, buf, name, type);
  check(`Upload respins: ${name}`, r.status === 400, `status ${r.status}`);
}
const big = await upload(evil, evilFilmId, Buffer.alloc(3 * 1024 * 1024), 'big.png', 'image/png');
check('Upload > 2 MB respins', big.status === 413, `status ${big.status}`);
const twoFiles = new FormData();
twoFiles.append('poster', new Blob([Buffer.from('a')]), 'a.png');
twoFiles.append('poster', new Blob([Buffer.from('b')]), 'b.png');
const tf = await evil.req('POST', `/api/films/${evilFilmId}/poster`, { body: twoFiles });
check('Două fișiere deodată respinse', tf.status === 400, `status ${tf.status}`);
const extraField = new FormData();
extraField.append('owner_id', '1');
extraField.append('poster', new Blob([Buffer.from('a')]), 'a.png');
const ef = await evil.req('POST', `/api/films/${evilFilmId}/poster`, { body: extraField });
check('Câmp în plus la upload respins', ef.status === 400, `status ${ef.status}`);
for (const p of ['/uploads/posters/../../.env', '/uploads/posters/..%2f..%2f.env', '/uploads/posters/%2e%2e/%2e%2e/package.json', '/uploads/', '/uploads/posters/', '/.env', '/.git/config', '/data/filme.db', '/package.json', '/src/app.js', '/node_modules/express/package.json']) {
  const r = await guest.req('GET', p);
  check(`Path traversal / fișier intern: ${p}`, r.status === 404 && !/SEED_|DB_PATH|"dependencies"|\[core\]/.test(r.text), `status ${r.status}`);
}

// ---------- 7. Sesiuni și CSRF ----------
const fakeSid = new Client('fals');
fakeSid.cookie = 'sid=' + 'A'.repeat(43);
check('Token inventat respins', (await fakeSid.req('GET', '/api/me/profile')).status === 401);
fakeSid.cookie = "sid=' OR 1=1 --";
check('Token cu SQL respins', (await fakeSid.req('GET', '/api/me/profile')).status === 401);
const csrf1 = await ana.req('POST', '/api/films', { json: { title: 'CSRF', year: 2000, genre: 'drama' }, headers: { Origin: 'https://evil.example' } });
check('CSRF cu Origin străin blocat', csrf1.status === 403, `status ${csrf1.status}`);
const csrf2 = await ana.req('DELETE', `/api/films/${anaFilm.id}`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
check('CSRF cu Sec-Fetch-Site: cross-site blocat', csrf2.status === 403, `status ${csrf2.status}`);
const csrf3 = await ana.req('POST', '/api/films', { body: 'title=CSRF&year=2000&genre=drama', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
check('Formular HTML clasic (fără JSON) nu creează nimic', csrf3.status === 400, `status ${csrf3.status}`);
const csrf4 = await ana.req('POST', '/api/films', { body: JSON.stringify({ title: 'CSRF', year: 2000, genre: 'drama' }), headers: { 'Content-Type': 'text/plain' } });
check('JSON trimis ca text/plain (truc CSRF) nu creează nimic', csrf4.status === 400, `status ${csrf4.status}`);
const loginCookie = (await new Client('c').req('POST', '/api/auth/login', { json: { email: 'ana@filme.test', password: USER_PW } })).headers.get('set-cookie') ?? '';
check('Cookie HttpOnly + SameSite=Strict', /HttpOnly/i.test(loginCookie) && /SameSite=Strict/i.test(loginCookie), loginCookie.replace(/sid=[^;]+/, 'sid=…'));
const cors = await guest.req('GET', '/api/films', { headers: { Origin: 'https://evil.example' } });
check('Fără CORS deschis', !cors.headers.get('access-control-allow-origin'), cors.headers.get('access-control-allow-origin') ?? 'absent');
const old = new Client('vechi');
await old.login('ana@filme.test', USER_PW);
const savedCookie = old.cookie;
await old.req('POST', '/api/auth/logout');
old.cookie = savedCookie;
check('Tokenul nu mai merge după logout', (await old.req('GET', '/api/me/profile')).status === 401);

// ---------- 8. Forță brută ----------
let limited = false;
for (let i = 0; i < 8; i++) {
  const r = await guest.req('POST', '/api/auth/login', { json: { email: 'mihai@filme.test', password: `ghicesc-${i}-parola` } });
  if (r.status === 429) { limited = true; break; }
}
check('Forța brută pe un cont e oprită (429)', limited);
const same1 = await guest.req('POST', '/api/auth/login', { json: { email: 'elena@filme.test', password: 'gresita-12345' } });
const same2 = await guest.req('POST', '/api/auth/login', { json: { email: 'nimeni@filme.test', password: 'gresita-12345' } });
check('Același mesaj pentru cont existent/inexistent la login', same1.status === same2.status && same1.text === same2.text);

// ---------- 9. Logică de business ----------
for (const body of [{ rating: 0, body: 'abc' }, { rating: 6, body: 'abc' }, { rating: -1, body: 'abc' }, { rating: 4.5, body: 'abc' }, { rating: 1e308, body: 'abc' }, { rating: '5', body: 'abc' }, { rating: null, body: 'abc' }]) {
  const r = await evil.req('POST', `/api/films/${anaFilm.id}/reviews`, { json: body });
  check(`Notă invalidă ${JSON.stringify(body.rating)}`, r.status === 400, `status ${r.status}`);
}
const firstReview = await evil.req('POST', `/api/films/${anaFilm.id}/reviews`, { json: { rating: 5, body: 'prima recenzie' } });
const parallel = await Promise.all([1, 2, 3, 4, 5].map(() => evil.req('POST', `/api/films/${anaFilm.id}/reviews`, { json: { rating: 5, body: 'în paralel' } })));
const extra = parallel.filter((r) => r.status === 201).length;
check('O singură recenzie per film, chiar și cu cereri în paralel', firstReview.status === 201 && extra === 0, `prima ${firstReview.status}, paralele create: ${extra}`);
for (const year of [1700, 3000, 2020.5, '2020', -1]) {
  const r = await evil.req('POST', '/api/films', { json: { title: 'An', year, genre: 'drama' } });
  check(`An invalid ${JSON.stringify(year)}`, r.status === 400, `status ${r.status}`);
}
const blockSelf = await admin.req('PATCH', `/api/admin/users/${admin.user.id}`, { json: { blocked: true } });
check('Adminul nu se poate bloca singur', blockSelf.status === 400, `status ${blockSelf.status}`);
const users = (await admin.req('GET', '/api/admin/users')).data.users;
const admin2 = users.find((u) => u.username === 'admin2');
const blockAdmin = await admin.req('PATCH', `/api/admin/users/${admin2.id}`, { json: { blocked: true } });
check('Adminul nu poate bloca alt admin', blockAdmin.status === 403, `status ${blockAdmin.status}`);

// ---------- 10. Erori ----------
for (const [m, p, opts] of [['POST', '/api/auth/login', { body: '{"email":', headers: { 'Content-Type': 'application/json' } }], ['POST', '/api/films', { body: 'x'.repeat(30000), headers: { 'Content-Type': 'application/json' } }], ['GET', '/api/films/99999999999'], ['PUT', '/api/me/watchlist/abc', { json: {} }], ['POST', '/api/auth/login', { body: '{}', headers: { 'Content-Type': 'application/json; charset=utf-16' } }]]) {
  const r = await (m === 'POST' || m === 'PUT' ? evil : guest).req(m, p, opts);
  check(`Eroare fără detalii interne: ${m} ${p}`, r.status >= 400 && r.status < 500 && !/at .*\.js|SqliteError|stack|node_modules/.test(r.text), `status ${r.status}`);
}
const headers = (await guest.req('GET', '/')).headers;
check('Fără X-Powered-By', !headers.get('x-powered-by'));
check('frame-ancestors none (clickjacking)', /frame-ancestors 'none'/.test(headers.get('content-security-policy') ?? ''));

console.log(`\n${passed.length} verificări trecute, ${findings.length} probleme găsite.\n`);
for (const f of findings) console.log(`PROBLEMĂ: ${f}`);
process.exitCode = findings.length ? 1 : 0;
