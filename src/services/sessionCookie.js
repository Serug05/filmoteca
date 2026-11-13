import { SESSION_COOKIE } from '../constants.js';

// HttpOnly: JavaScript-ul din pagină nu poate citi cookie-ul (un XSS nu fură sesiunea).
// SameSite=Strict: browserul nu trimite cookie-ul în cereri pornite de pe alte site-uri (CSRF).
function cookieOptions(config) {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' };
}

export function setSessionCookie(res, token, config) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: config.sessionTtlMs });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}
