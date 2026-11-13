import { ROLES } from '../constants.js';

export function findUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

// Rolul NU vine niciodată din cererea utilizatorului: rutele publice apelează fără `role`,
// iar doar scriptul de seed creează administratori.
export function createUser(db, { username, email, passwordHash, role = ROLES.USER }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(username, email, passwordHash, role);
  return findUserById(db, lastInsertRowid);
}

export function updateEmail(db, id, email) {
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, id);
  return findUserById(db, id);
}

export function updatePasswordHash(db, id, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

export function getUserStats(db, id) {
  return db.prepare(`
    SELECT (SELECT COUNT(*) FROM films WHERE owner_id = ?) AS films,
           (SELECT COUNT(*) FROM reviews WHERE user_id = ?) AS reviews,
           (SELECT COUNT(*) FROM watchlist WHERE user_id = ?) AS watchlist
  `).get(id, id, id);
}

// Ce primește utilizatorul despre propriul cont. Hash-ul parolei nu iese niciodată din server.
export function toPrivateUser(user) {
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}
