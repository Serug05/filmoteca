import helmet from 'helmet';

// Antete HTTP de securitate. CSP-ul permite doar scripturi, stiluri și imagini de pe propriul server:
// chiar dacă cineva reușește să strecoare HTML în pagină, un <script> inline nu va rula.
export function securityHeaders(config) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.cookieSecure ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.cookieSecure ? undefined : false,
  });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function rejectCrossOrigin(res) {
  res.status(403).json({ error: 'Cererea vine de pe alt site și a fost blocată.' });
}

// Protecție CSRF: cererile care modifică date trebuie să vină de pe același site.
// Browserele trimit Sec-Fetch-Site și/sau Origin; un client fără browser (curl, script)
// nu are cookie-urile victimei, deci nu poate face CSRF.
export function crossOriginGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'none' ? next() : rejectCrossOrigin(res);
  }

  const origin = req.get('origin');
  if (!origin) return next();

  try {
    return new URL(origin).host === req.get('host') ? next() : rejectCrossOrigin(res);
  } catch {
    return rejectCrossOrigin(res);
  }
}
