import { GENRES } from '../constants.js';

export const FILMS_PER_PAGE = 12;

// Coloanele cerute explicit: din tabelul users luăm doar username-ul, niciodată email sau parolă.
const SELECT_FILM = `
  SELECT f.id, f.title, f.year, f.genre, f.description, f.poster, f.created_at,
         f.owner_id, u.username AS owner_username
  FROM films f
  JOIN users u ON u.id = f.owner_id`;

export function listFilms(db, { page }) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM films').get().n;
  const films = db
    .prepare(`${SELECT_FILM} ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?`)
    .all(FILMS_PER_PAGE, (page - 1) * FILMS_PER_PAGE);

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
    owner: { id: film.owner_id, username: film.owner_username },
    createdAt: film.created_at,
  };
}
