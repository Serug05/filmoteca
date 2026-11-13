import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROLES } from '../src/constants.js';
import { openDb } from '../src/db/index.js';
import { hashPassword } from '../src/services/passwords.js';
import { FILMS, REVIEWS, WATCHLIST } from './seed-data.js';

// Parolele conturilor demo din README vin din .env, nu sunt scrise în cod.
export function readSeedPasswords(env = process.env) {
  const missing = ['SEED_ADMIN_PASSWORD', 'SEED_USER_PASSWORD'].filter((name) => (env[name] ?? '').length < 10);
  if (missing.length) {
    throw new Error(`Lipsesc din .env: ${missing.join(', ')} (minimum 10 caractere). Vezi .env.example.`);
  }
  return { admin: env.SEED_ADMIN_PASSWORD, user: env.SEED_USER_PASSWORD };
}

// Conturile care nu apar în README primesc parole aleatorii, imposibil de ghicit.
const randomPassword = () => crypto.randomBytes(24).toString('base64url');

// Resetează baza de date și o umple cu date demo. Returnează câte înregistrări a creat.
export async function seedDatabase(config, passwords) {
  const users = [
    { username: 'admin', email: 'admin@filme.test', role: ROLES.ADMIN, password: passwords.admin },
    { username: 'admin2', email: 'admin2@filme.test', role: ROLES.ADMIN, password: randomPassword() },
    { username: 'ana', email: 'ana@filme.test', role: ROLES.USER, password: passwords.user },
    { username: 'mihai', email: 'mihai@filme.test', role: ROLES.USER, password: randomPassword() },
    { username: 'elena', email: 'elena@filme.test', role: ROLES.USER, password: randomPassword() },
  ];
  const hashes = await Promise.all(users.map((user) => hashPassword(user.password)));

  const db = openDb(config.dbPath);
  try {
    db.transaction(() => {
      db.exec(`
        DELETE FROM sessions; DELETE FROM admin_log; DELETE FROM watchlist;
        DELETE FROM reviews; DELETE FROM films; DELETE FROM users;
      `);

      const userIds = {};
      const insertUser = db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)');
      users.forEach((user, i) => {
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
    })();
  } finally {
    db.close();
  }

  // Posterele vechi nu mai aparțin niciunui film după reset.
  const postersDir = path.join(config.uploadsDir, 'posters');
  fs.rmSync(postersDir, { recursive: true, force: true });
  fs.mkdirSync(postersDir, { recursive: true });

  return { users: users.length, films: FILMS.length, reviews: REVIEWS.length, watchlist: WATCHLIST.length };
}

export function describeSeed(counts) {
  const total = counts.users + counts.films + counts.reviews + counts.watchlist;
  return `${counts.users} utilizatori, ${counts.films} filme, ${counts.reviews} recenzii, ${counts.watchlist} intrări în liste (${total} înregistrări)`;
}
