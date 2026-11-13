import { SESSION_COOKIE } from '../constants.js';
import { findSessionUser } from '../models/sessions.js';
import { readCookie } from '../services/sessionCookie.js';

// Rulează la fiecare cerere API: află cine este utilizatorul pe baza cookie-ului de sesiune.
export function loadSession(db) {
  return (req, res, next) => {
    req.sessionToken = readCookie(req, SESSION_COOKIE);
    req.user = req.sessionToken ? findSessionUser(db, req.sessionToken) : null;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Nu ai permisiunea pentru această acțiune.' });
    next();
  };
}
