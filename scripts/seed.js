import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, loadEnvFile } from '../src/config.js';
import { ROLES } from '../src/constants.js';
import { openDb } from '../src/db/index.js';
import { hashPassword } from '../src/services/passwords.js';
import { FILMS, REVIEWS, WATCHLIST } from './seed-data.js';

// Resetează baza de date și o umple cu date demo.

loadEnvFile();

function requireSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 10) {
    console.error(`Lipsește ${name} (minimum 10 caractere). Rulează mai întâi: cp .env.example .env`);
    process.exit(1);
  }
  return value;
}

// Conturile care nu apar în README primesc parole aleatorii, imposibil de ghicit.
const randomPassword = () => crypto.randomBytes(24).toString('base64url');

const USERS = [
  { username: 'admin', email: 'admin@filme.test', role: ROLES.ADMIN, password: requireSecret('SEED_ADMIN_PASSWORD') },
  { username: 'admin2', email: 'admin2@filme.test', role: ROLES.ADMIN, password: randomPassword() },
  { username: 'ana', email: 'ana@filme.test', role: ROLES.USER, password: requireSecret('SEED_USER_PASSWORD') },
  { username: 'mihai', email: 'mihai@filme.test', role: ROLES.USER, password: randomPassword() },
  { username: 'elena', email: 'elena@filme.test', role: ROLES.USER, password: randomPassword() },
];

const config = loadConfig();
const db = openDb(config.dbPath);

const hashes = await Promise.all(USERS.map((user) => hashPassword(user.password)));

const seed = db.transaction(() => {
  db.exec('DELETE FROM sessions; DELETE FROM watchlist; DELETE FROM reviews; DELETE FROM films; DELETE FROM users;');

  const userIds = {};
  const insertUser = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
  USERS.forEach((user, i) => {
    userIds[user.username] = insertUser.run(user.username, user.email, hashes[i], user.role).lastInsertRowid;
  });

  const filmIds = {};
  const insertFilm = db.prepare('INSERT INTO films (owner_id, title, year, genre, description) VALUES (?, ?, ?, ?, ?)');
  for (const film of FILMS) {
    filmIds[film.title] = insertFilm.run(userIds[film.owner], film.title, film.year, film.genre, film.description).lastInsertRowid;
  }

  const insertReview = db.prepare('INSERT INTO reviews (film_id, user_id, rating, body) VALUES (?, ?, ?, ?)');
  for (const review of REVIEWS) {
    insertReview.run(filmIds[review.film], userIds[review.user], review.rating, review.body);
  }

  const insertEntry = db.prepare('INSERT INTO watchlist (user_id, film_id, status, watched_on, note) VALUES (?, ?, ?, ?, ?)');
  for (const entry of WATCHLIST) {
    insertEntry.run(userIds[entry.user], filmIds[entry.film], entry.status, entry.watchedOn ?? null, entry.note);
  }
});

seed();
db.close();

// Posterele vechi nu mai aparțin niciunui film după reset.
const postersDir = path.join(config.uploadsDir, 'posters');
fs.rmSync(postersDir, { recursive: true, force: true });
fs.mkdirSync(postersDir, { recursive: true });

const total = USERS.length + FILMS.length + REVIEWS.length + WATCHLIST.length;
console.log(`Seed gata: ${USERS.length} utilizatori, ${FILMS.length} filme, ${REVIEWS.length} recenzii, ${WATCHLIST.length} intrări în liste (${total} înregistrări).`);
