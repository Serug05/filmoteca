import { GENRES } from '../constants.js';
import { likePattern } from '../services/search.js';

export const FILMS_PER_PAGE = 12;

// Coloanele cerute explicit: din tabelul users luăm doar username-ul, niciodată email sau parolă.
// Media notelor și numărul de recenzii se calculează din tabelul reviews.
const SELECT_FILM = `
  SELECT f.id, f.title, f.year, f.genre, f.description, f.poster, f.created_at,
         f.owner_id, u.username AS owner_username,
         stats.avg_rating, COALESCE(stats.review_count, 0) AS review_count
  FROM films f
  JOIN users u ON u.id = f.owner_id
  LEFT JOIN (
    SELECT film_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
    FROM reviews
    GROUP BY film_id
  ) stats ON stats.film_id = f.id`;

// Ordinea de sortare nu poate fi trimisă ca parametru „?”, așa că alegem dintr-o listă fixă
// de bucăți SQL scrise de noi. Valoarea din URL doar selectează una dintre ele.
const ORDER_BY = new Map([
  ['recent', 'f.created_at DESC, f.id DESC'],
  ['rating', 'stats.avg_rating IS NULL, stats.avg_rating DESC, review_count DESC, f.id DESC'],
  ['year', 'f.year DESC, f.id DESC'],
  ['title', 'f.title COLLATE NOCASE ASC, f.id ASC'],
]);

// Interogarea se compune doar din bucăți SQL fixe; tot ce vine de la utilizator (textul căutat,
// genul) ajunge în baza de date exclusiv prin parametri „?”, deci nu poate schimba interogarea.
export function listFilms(db, { page, q, genre, sort = 'recent' }) {
  const conditions = [];
  const params = [];
  if (q) {
    conditions.push("normalize_text(f.title) LIKE ? ESCAPE '\\'");
    params.push(likePattern(q));
  }
  if (genre) {
    conditions.push('f.genre = ?');
    params.push(genre);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = ORDER_BY.get(sort) ?? ORDER_BY.get('recent');

  const total = db.prepare(`SELECT COUNT(*) AS n FROM films f ${where}`).get(...params).n;
  const films = db
    .prepare(`${SELECT_FILM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, FILMS_PER_PAGE, (page - 1) * FILMS_PER_PAGE);

  return { films, total, totalPages: Math.max(1, Math.ceil(total / FILMS_PER_PAGE)) };
}

export function findFilmById(db, id) {
  return db.prepare(`${SELECT_FILM} WHERE f.id = ?`).get(id);
}

export function createFilm(db, ownerId, { title, year, genre, description }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO films (owner_id, title, year, genre, description) VALUES (?, ?, ?, ?, ?)')
    .run(ownerId, title, year, genre, description);
  return findFilmById(db, lastInsertRowid);
}

export function updateFilm(db, id, { title, year, genre, description }) {
  db.prepare('UPDATE films SET title = ?, year = ?, genre = ?, description = ? WHERE id = ?')
    .run(title, year, genre, description, id);
  return findFilmById(db, id);
}

export function setFilmPoster(db, id, poster) {
  db.prepare('UPDATE films SET poster = ? WHERE id = ?').run(poster, id);
  return findFilmById(db, id);
}

export function deleteFilm(db, id) {
  db.prepare('DELETE FROM films WHERE id = ?').run(id);
}

// Are filmul recenzii sau intrări în listele altor utilizatori? Atunci doar adminul îl poate șterge,
// altfel proprietarul ar șterge, indirect, date care nu îi aparțin.
export function isUsedByOthers(db, filmId, ownerId) {
  const { used } = db.prepare(`
    SELECT EXISTS (SELECT 1 FROM reviews WHERE film_id = ? AND user_id != ?)
        OR EXISTS (SELECT 1 FROM watchlist WHERE film_id = ? AND user_id != ?) AS used
  `).get(filmId, ownerId, filmId, ownerId);
  return used === 1;
}

export function toFilmJson(film) {
  return {
    id: film.id,
    title: film.title,
    year: film.year,
    genre: film.genre,
    genreLabel: GENRES[film.genre],
    description: film.description,
    posterUrl: film.poster ? `/uploads/posters/${film.poster}` : null,
    rating: {
      average: film.avg_rating === null ? null : Math.round(film.avg_rating * 10) / 10,
      count: film.review_count,
    },
    owner: { id: film.owner_id, username: film.owner_username },
    createdAt: film.created_at,
  };
}
