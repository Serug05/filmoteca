import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { findFilmById } from '../models/films.js';
import { deleteOtherSessions } from '../models/sessions.js';
import { findUserById, getUserStats, toPrivateUser, updateEmail, updatePasswordHash } from '../models/users.js';
import {
  createEntry,
  deleteOwnEntry,
  listOwnEntries,
  toEntryJson,
  updateOwnEntry,
} from '../models/watchlist.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import { emailChangeSchema, passwordChangeSchema } from '../validation/account.schemas.js';
import { parseId } from '../validation/common.js';
import {
  watchlistCreateSchema,
  watchlistQuerySchema,
  watchlistUpdateSchema,
} from '../validation/watchlist.schemas.js';

const ENTRY_NOT_FOUND = { error: 'Intrarea nu există în lista ta.' };
const WRONG_PASSWORD = { error: 'Parola actuală nu este corectă.', fields: { currentPassword: 'Parola actuală nu este corectă.' } };

// Tot ce e sub /api/me privește DOAR utilizatorul conectat: id-ul lui vine din sesiune,
// niciodată din URL sau din corpul cererii. Nu există nicio rută pentru „datele altcuiva”.
export function meRouter({ db, limiters }) {
  const router = Router();
  router.use(requireAuth);

  function profileJson(user) {
    return { ...toPrivateUser(user), createdAt: user.created_at, stats: getUserStats(db, user.id) };
  }

  // ---------- Profil ----------

  router.get('/profile', (req, res) => {
    res.json({ profile: profileJson(findUserById(db, req.user.id)) });
  });

  router.put('/profile', limiters.account, validateBody(emailChangeSchema), async (req, res) => {
    const user = findUserById(db, req.user.id);
    if (!(await verifyPassword(user.password_hash, req.body.currentPassword))) {
      return res.status(400).json(WRONG_PASSWORD);
    }

    try {
      res.json({ profile: profileJson(updateEmail(db, user.id, req.body.email)) });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Emailul este deja folosit.', fields: { email: 'Emailul este deja folosit.' } });
      }
      throw err;
    }
  });

  router.put('/password', limiters.account, validateBody(passwordChangeSchema), async (req, res) => {
    const user = findUserById(db, req.user.id);
    if (!(await verifyPassword(user.password_hash, req.body.currentPassword))) {
      return res.status(400).json(WRONG_PASSWORD);
    }

    updatePasswordHash(db, user.id, await hashPassword(req.body.newPassword));
    deleteOtherSessions(db, user.id, req.sessionToken);
    res.status(204).end();
  });

  // ---------- Lista mea (privată) ----------

  router.get('/watchlist', validateQuery(watchlistQuerySchema), (req, res) => {
    res.json({ entries: listOwnEntries(db, req.user.id, req.validQuery).map(toEntryJson) });
  });

  router.post('/watchlist', validateBody(watchlistCreateSchema), (req, res) => {
    if (!findFilmById(db, req.body.filmId)) {
      return res.status(404).json({ error: 'Filmul nu există.' });
    }

    try {
      res.status(201).json({ entry: toEntryJson(createEntry(db, req.user.id, req.body)) });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Filmul este deja în lista ta.' });
      }
      throw err;
    }
  });

  router.put('/watchlist/:id', validateBody(watchlistUpdateSchema), (req, res) => {
    const id = parseId(req.params.id);
    const entry = id && updateOwnEntry(db, req.user.id, id, req.body);
    if (!entry) return res.status(404).json(ENTRY_NOT_FOUND);
    res.json({ entry: toEntryJson(entry) });
  });

  router.delete('/watchlist/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !deleteOwnEntry(db, req.user.id, id)) return res.status(404).json(ENTRY_NOT_FOUND);
    res.status(204).end();
  });

  return router;
}
