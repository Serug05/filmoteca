import { rateLimit } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const TOO_MANY = { error: 'Prea multe încercări. Încearcă din nou peste câteva minute.' };

const common = { standardHeaders: 'draft-8', legacyHeaders: false, message: TOO_MANY };

function normalizedEmail(req) {
  return String(req.body?.email ?? '').trim().toLowerCase();
}

// Instanțe noi la fiecare createApp(), ca testele să nu-și împartă contoarele.
export function createAuthLimiters() {
  return {
    // Pe adresa IP: oprește pe cineva care încearcă multe conturi sau parole de pe aceeași mașină.
    loginByIp: rateLimit({ ...common, windowMs: FIFTEEN_MINUTES, limit: 20, skipSuccessfulRequests: true }),

    // Pe email: oprește ghicirea parolei unui singur cont, chiar și din IP-uri diferite.
    // Se aplică la fel și emailurilor fără cont, ca să nu dezvăluie ce conturi există.
    loginByEmail: rateLimit({
      ...common,
      windowMs: FIFTEEN_MINUTES,
      limit: 5,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => `email:${normalizedEmail(req)}`,
    }),

    register: rateLimit({ ...common, windowMs: ONE_HOUR, limit: 20 }),

    // Pe utilizator: limitează încercările de a ghici parola actuală dintr-o sesiune deschisă
    // (la schimbarea emailului sau a parolei). Rulează doar după requireAuth.
    account: rateLimit({
      ...common,
      windowMs: FIFTEEN_MINUTES,
      limit: 10,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => `user:${req.user.id}`,
    }),
  };
}
