import crypto from 'node:crypto';

// 32 de octeți aleatori codați base64url = exact 43 de caractere.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(db, userId, ttlMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, now, now + ttlMs);
  return token;
}

// Returnează utilizatorul sesiunii doar dacă tokenul există, nu a expirat și contul nu e blocat.
export function findSessionUser(db, token) {
  if (typeof token !== 'string' || !TOKEN_FORMAT.test(token)) return null;

  return db.prepare(`
    SELECT u.id, u.username, u.email, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_blocked = 0
  `).get(hashToken(token), Date.now()) ?? null;
}

export function deleteSession(db, token) {
  if (typeof token !== 'string') return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

// La blocarea unui cont: toate sesiunile lui se închid imediat.
export function deleteUserSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// După schimbarea parolei: toate celelalte sesiuni ale utilizatorului se închid
// (de ex. un dispozitiv pierdut), doar cea curentă rămâne.
export function deleteOtherSessions(db, userId, keepToken) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, hashToken(keepToken));
}

export function deleteExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}
