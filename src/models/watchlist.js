import { GENRES, WATCH_STATUSES } from '../constants.js';

// Lista de vizionare e privată. De aceea fiecare funcție de aici primește userId și îl pune în
// WHERE: o intrare se caută mereu după id ȘI după proprietar. Dacă schimbi id-ul din URL cu
// al altcuiva, interogarea pur și simplu nu găsește nimic (404), deci nici nu afli că există.

const SELECT_ENTRY = `
  SELECT w.id, w.film_id, w.status, w.watched_on, w.note, w.created_at,
         f.title, f.year, f.genre, f.poster
  FROM watchlist w
  JOIN films f ON f.id = w.film_id`;

const MAX_ENTRIES = 500;

export function listOwnEntries(db, userId, { status, film } = {}) {
  const conditions = ['w.user_id = ?'];
  const params = [userId];
  if (status) {
    conditions.push('w.status = ?');
    params.push(status);
  }
  if (film) {
    conditions.push('w.film_id = ?');
    params.push(film);
  }

  return db.prepare(`
    ${SELECT_ENTRY}
    WHERE ${conditions.join(' AND ')}
    ORDER BY CASE w.status WHEN 'de_vazut' THEN 0 ELSE 1 END, w.watched_on DESC, w.created_at DESC, w.id DESC
    LIMIT ?
  `).all(...params, MAX_ENTRIES);
}

export function findOwnEntry(db, userId, id) {
  return db.prepare(`${SELECT_ENTRY} WHERE w.id = ? AND w.user_id = ?`).get(id, userId);
}

export function createEntry(db, userId, { filmId, status, watchedOn, note }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO watchlist (user_id, film_id, status, watched_on, note) VALUES (?, ?, ?, ?, ?)')
    .run(userId, filmId, status, watchedOn, note);
  return findOwnEntry(db, userId, lastInsertRowid);
}

// Returnează intrarea actualizată sau null dacă nu există o intrare cu acest id în lista utilizatorului.
export function updateOwnEntry(db, userId, id, { status, watchedOn, note }) {
  const { changes } = db
    .prepare('UPDATE watchlist SET status = ?, watched_on = ?, note = ? WHERE id = ? AND user_id = ?')
    .run(status, watchedOn, note, id, userId);
  return changes ? findOwnEntry(db, userId, id) : null;
}

export function deleteOwnEntry(db, userId, id) {
  return db.prepare('DELETE FROM watchlist WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}

export function toEntryJson(entry) {
  return {
    id: entry.id,
    status: entry.status,
    statusLabel: WATCH_STATUSES[entry.status],
    watchedOn: entry.watched_on,
    note: entry.note,
    createdAt: entry.created_at,
    film: {
      id: entry.film_id,
      title: entry.title,
      year: entry.year,
      genreLabel: GENRES[entry.genre],
      posterUrl: entry.poster ? `/uploads/posters/${entry.poster}` : null,
    },
  };
}
