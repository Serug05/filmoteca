import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { openDb } from '../src/db/index.js';
import { readSeedPasswords, seedDatabase } from '../scripts/seed-lib.js';

test('seed-ul creează cel puțin 2 utilizatori pentru fiecare rol și peste 20 de înregistrări', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmoteca-seed-'));
  const config = { dbPath: path.join(dir, 'filme.db'), uploadsDir: path.join(dir, 'uploads') };
  try {
    const counts = await seedDatabase(config, { admin: 'parola-admin-demo', user: 'parola-user-demo' });
    assert.ok(counts.users + counts.films + counts.reviews + counts.watchlist >= 20);

    const db = openDb(config.dbPath);
    const roles = Object.fromEntries(db.prepare('SELECT role, COUNT(*) AS n FROM users GROUP BY role').all().map((r) => [r.role, r.n]));
    const hashes = db.prepare('SELECT password_hash FROM users').all().map((r) => r.password_hash);
    const posters = db.prepare('SELECT poster FROM films').all().map((r) => r.poster);
    db.close();

    assert.ok(roles.admin >= 2 && roles.user >= 2);
    assert.ok(hashes.every((hash) => hash.startsWith('$argon2id$')));
    assert.ok(posters.every((name) => fs.existsSync(path.join(config.uploadsDir, 'posters', name))), 'fiecare film demo are un poster pe disc');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('seed-ul refuză să ruleze fără parolele demo din .env', () => {
  assert.throws(() => readSeedPasswords({}), /SEED_ADMIN_PASSWORD, SEED_USER_PASSWORD/);
  assert.throws(() => readSeedPasswords({ SEED_ADMIN_PASSWORD: 'scurta', SEED_USER_PASSWORD: 'parola-buna-123' }), /SEED_ADMIN_PASSWORD/);
});
