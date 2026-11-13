import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db/index.js';
import { createFilm } from '../src/models/films.js';
import { createUser } from '../src/models/users.js';
import { hashPassword } from '../src/services/passwords.js';

export const ANA = { username: 'ana', email: 'ana@test.ro', password: 'parola-ana-123' };
export const MIHAI = { username: 'mihai', email: 'mihai@test.ro', password: 'parola-mihai-123' };
export const ADMIN = { username: 'admin', email: 'admin@test.ro', password: 'parola-admin-123', role: 'admin' };

const tempDirs = [];
process.on('exit', () => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// Fiecare test primește o aplicație nouă, cu propria bază de date în memorie
// și propriul folder temporar pentru fișierele încărcate (șters la final).
export function makeApp(overrides = {}) {
  const db = openDb(':memory:');
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmoteca-test-'));
  tempDirs.push(uploadsDir);
  const config = { cookieSecure: false, sessionTtlMs: 60 * 60 * 1000, uploadsDir, ...overrides };
  return { db, app: createApp({ db, config }), postersDir: path.join(uploadsDir, 'posters') };
}

export async function addUser(db, { username, email, password, role }) {
  return createUser(db, { username, email, role, passwordHash: await hashPassword(password) });
}

export function addFilm(db, owner, overrides = {}) {
  return createFilm(db, owner.id, { title: 'Film de test', year: 2020, genre: 'drama', description: '', ...overrides });
}

// Un „browser” care păstrează cookie-ul de sesiune după login.
export async function loginAs(app, { email, password }) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}

// Extrage „sid=...” din răspuns, ca să-l putem retrimite manual.
export function sessionCookie(response) {
  return response.headers['set-cookie']?.find((c) => c.startsWith('sid='))?.split(';')[0];
}
