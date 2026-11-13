-- Schema bazei de date. Rulează la fiecare pornire; IF NOT EXISTS o face sigură de repetat.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_blocked    INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tokenul de sesiune nu se salvează în clar, doar hash-ul lui SHA-256.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Catalogul public de filme. owner_id = utilizatorul care a adăugat filmul.
CREATE TABLE IF NOT EXISTS films (
  id          INTEGER PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  year        INTEGER NOT NULL CHECK (year BETWEEN 1888 AND 2100),
  genre       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  poster      TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_films_owner ON films(owner_id);

-- Recenzii publice: o singură recenzie per utilizator pentru fiecare film.
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY,
  film_id    INTEGER NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (film_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

-- Jurnalul acțiunilor administratorilor: cine, ce a făcut, asupra cui și când.
CREATE TABLE IF NOT EXISTS admin_log (
  id          INTEGER PRIMARY KEY,
  admin_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT    NOT NULL,
  target_type TEXT    NOT NULL,
  target_id   INTEGER,
  details     TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Lista privată de vizionare: o vede doar proprietarul ei.
CREATE TABLE IF NOT EXISTS watchlist (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id    INTEGER NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'de_vazut' CHECK (status IN ('de_vazut', 'vazut')),
  watched_on TEXT,
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, film_id)
);
