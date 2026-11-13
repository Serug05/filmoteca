import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validation/auth.schemas.js';
import { createUser, findUserByEmail, toPrivateUser } from '../models/users.js';
import { createSession, deleteSession } from '../models/sessions.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../services/passwords.js';
import { clearSessionCookie, setSessionCookie } from '../services/sessionCookie.js';

// Același mesaj pentru email inexistent și parolă greșită: nu dezvăluim ce conturi există.
const INVALID_LOGIN = { error: 'Email sau parolă incorecte.' };

export function authRouter({ db, config, limiters }) {
  const router = Router();

  // La fiecare autentificare emitem un token nou și ștergem orice token primit înainte
  // (apărare contra „session fixation”).
  function startSession(req, res, userId) {
    deleteSession(db, req.sessionToken);
    setSessionCookie(res, createSession(db, userId, config.sessionTtlMs), config);
  }

  router.post('/register', limiters.register, validateBody(registerSchema), async (req, res) => {
    const { username, email, password } = req.body;
    const passwordHash = await hashPassword(password);

    let user;
    try {
      user = createUser(db, { username, email, passwordHash });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Numele de utilizator sau emailul este deja folosit.' });
      }
      throw err;
    }

    startSession(req, res, user.id);
    res.status(201).json({ user: toPrivateUser(user) });
  });

  router.post('/login', limiters.loginByIp, limiters.loginByEmail, validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const user = findUserByEmail(db, email);
    const passwordOk = user
      ? await verifyPassword(user.password_hash, password)
      : await verifyAgainstDummy(password);

    if (!passwordOk) return res.status(401).json(INVALID_LOGIN);
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Contul este blocat. Contactează un administrator.' });
    }

    startSession(req, res, user.id);
    res.json({ user: toPrivateUser(user) });
  });

  // Logout-ul șterge sesiunea din baza de date: tokenul vechi nu mai funcționează nicăieri.
  router.post('/logout', (req, res) => {
    deleteSession(db, req.sessionToken);
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user ? toPrivateUser(req.user) : null });
  });

  return router;
}
