import { likePattern } from '../services/search.js';

// Interogări folosite doar de rutele de administrare (protejate de requireRole('admin')).

const USERS_PER_PAGE = 25;
const REVIEWS_PER_PAGE = 20;

const SELECT_ADMIN_USER = `
  SELECT u.id, u.username, u.email, u.role, u.is_blocked, u.created_at,
         (SELECT COUNT(*) FROM films WHERE owner_id = u.id) AS films,
         (SELECT COUNT(*) FROM reviews WHERE user_id = u.id) AS reviews
  FROM users u`;

// Ca la catalog: SQL-ul e format doar din bucăți fixe, textul căutat ajunge doar prin „?”.
export function listUsers(db, { q, page }) {
  const params = [];
  let where = '';
  if (q) {
    where = "WHERE normalize_text(u.username) LIKE ? ESCAPE '\\' OR normalize_text(u.email) LIKE ? ESCAPE '\\'";
    params.push(likePattern(q), likePattern(q));
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM users u ${where}`).get(...params).n;
  const users = db
    .prepare(`${SELECT_ADMIN_USER} ${where} ORDER BY u.id LIMIT ? OFFSET ?`)
    .all(...params, USERS_PER_PAGE, (page - 1) * USERS_PER_PAGE);

  return { users, total, totalPages: Math.max(1, Math.ceil(total / USERS_PER_PAGE)) };
}

export function findAdminUser(db, id) {
  return db.prepare(`${SELECT_ADMIN_USER} WHERE u.id = ?`).get(id);
}

export function setUserBlocked(db, id, blocked) {
  db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, id);
}

export function toAdminUserJson(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isBlocked: user.is_blocked === 1,
    createdAt: user.created_at,
    films: user.films,
    reviews: user.reviews,
  };
}

export function getStats(db) {
  const totals = db.prepare(`
    SELECT (SELECT COUNT(*) FROM users) AS users,
           (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
           (SELECT COUNT(*) FROM users WHERE is_blocked = 1) AS blocked,
           (SELECT COUNT(*) FROM films) AS films,
           (SELECT COUNT(*) FROM reviews) AS reviews,
           (SELECT COUNT(*) FROM watchlist) AS watchlistEntries
  `).get();

  const topFilms = db.prepare(`
    SELECT f.id, f.title, ROUND(AVG(r.rating), 1) AS average, COUNT(*) AS count
    FROM reviews r
    JOIN films f ON f.id = r.film_id
    GROUP BY f.id
    ORDER BY average DESC, count DESC, f.id
    LIMIT 5
  `).all();

  const topReviewers = db.prepare(`
    SELECT u.username, COUNT(*) AS count
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    GROUP BY u.id
    ORDER BY count DESC, u.username
    LIMIT 5
  `).all();

  return { totals, topFilms, topReviewers };
}

export function listRecentReviews(db, { page }) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n;
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at, r.film_id, f.title AS film_title, u.username AS author_username
    FROM reviews r
    JOIN films f ON f.id = r.film_id
    JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?
  `).all(REVIEWS_PER_PAGE, (page - 1) * REVIEWS_PER_PAGE);

  return {
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
      film: { id: r.film_id, title: r.film_title },
      author: r.author_username,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE)),
  };
}
