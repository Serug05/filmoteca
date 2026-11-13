import { SESSION_COOKIE } from '../constants.js';

// HttpOnly: JavaScript-ul din pagină nu poate citi cookie-ul (un XSS nu fură sesiunea).
// SameSite=Strict: browserul nu trimite cookie-ul în cereri pornite de pe alte site-uri (CSRF).
// Secure: cookie-ul circulă doar prin HTTPS. E activ dacă e cerut în .env (COOKIE_SECURE=true)
// sau, automat, dacă cererea chiar a venit prin HTTPS.
function cookieOptions(req, config) {
  return { httpOnly: true, secure: config.cookieSecure || req.secure, sameSite: 'strict', path: '/' };
}

export function setSessionCookie(res, token, config) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(res.req, config), maxAge: config.sessionTtlMs });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(res.req, config));
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
