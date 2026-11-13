// Din tabelul users luăm doar username-ul autorului, niciodată email sau parolă.
const SELECT_REVIEW = `
  SELECT r.id, r.film_id, r.user_id, r.rating, r.body, r.created_at, r.updated_at,
         u.username AS author_username
  FROM reviews r
  JOIN users u ON u.id = r.user_id`;

const MAX_REVIEWS_PER_FILM = 100;

export function listReviewsForFilm(db, filmId) {
  return db
    .prepare(`${SELECT_REVIEW} WHERE r.film_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT ?`)
    .all(filmId, MAX_REVIEWS_PER_FILM);
}

export function findReviewById(db, id) {
  return db.prepare(`${SELECT_REVIEW} WHERE r.id = ?`).get(id);
}

export function createReview(db, { filmId, userId, rating, body }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO reviews (film_id, user_id, rating, body) VALUES (?, ?, ?, ?)')
    .run(filmId, userId, rating, body);
  return findReviewById(db, lastInsertRowid);
}

export function updateReview(db, id, { rating, body }) {
  db.prepare("UPDATE reviews SET rating = ?, body = ?, updated_at = datetime('now') WHERE id = ?").run(rating, body, id);
  return findReviewById(db, id);
}

export function deleteReview(db, id) {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
}

export function toReviewJson(review) {
  return {
    id: review.id,
    filmId: review.film_id,
    rating: review.rating,
    body: review.body,
    author: { id: review.user_id, username: review.author_username },
    createdAt: review.created_at,
    edited: review.updated_at !== review.created_at,
  };
}
