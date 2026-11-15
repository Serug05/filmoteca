import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { ROOT_DIR } from './config.js';
import { loadSession } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { createAuthLimiters } from './middleware/rateLimits.js';
import { crossOriginGuard, securityHeaders } from './middleware/security.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { filmsRouter } from './routes/films.routes.js';
import { genresRouter } from './routes/genres.routes.js';
import { meRouter } from './routes/me.routes.js';
import { reviewsRouter } from './routes/reviews.routes.js';

const THREE_DIR = path.join(ROOT_DIR, 'node_modules', 'three', 'build');
const THREE_FILES = new Set(['three.module.js', 'three.core.js']);

// Construiește aplicația fără să o pornească; testele o folosesc direct, cu o bază de date în memorie.
export function createApp({ db, config }) {
  const postersDir = path.join(config.uploadsDir, 'posters');
  fs.mkdirSync(postersDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? 0);
  app.use(securityHeaders(config));

  // Doar folderul public/ este servit static, niciodată rădăcina proiectului (.env, baza de date).
  app.use(express.static(path.join(ROOT_DIR, 'public'), { dotfiles: 'ignore' }));

  // Three.js (grafica 3D din prima pagină) e servit de pe propriul server, ca CSP-ul să rămână
  // „doar scripturi proprii”. Se servesc exact cele două fișiere necesare, nimic altceva din node_modules.
  app.get('/vendor/three/:file', (req, res, next) => {
    if (!THREE_FILES.has(req.params.file)) return next();
    res.type('text/javascript');
    res.set('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.join(THREE_DIR, req.params.file));
  });

  // Posterele sunt publice. În folder ajung doar fișiere .webp create de server, cu nume aleatorii.
  app.use('/uploads/posters', express.static(postersDir, { dotfiles: 'deny', index: false, redirect: false }));

  const api = express.Router();
  api.use(crossOriginGuard);
  api.use(express.json({ limit: '20kb' }));
  api.use(loadSession(db));
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const limiters = createAuthLimiters();
  api.use('/auth', authRouter({ db, config, limiters }));
  api.use('/me', meRouter({ db, limiters }));
  api.use('/admin', adminRouter({ db }));
  api.use('/films', filmsRouter({ db, postersDir }));
  api.use('/genres', genresRouter());
  api.use(reviewsRouter({ db }));
  api.use(apiNotFound);

  app.use('/api', api);

  // Orice altă adresă: pagina 404 proprie, fără detalii despre server.
  app.use((req, res) => {
    res.status(404).sendFile(path.join(ROOT_DIR, 'public', '404.html'));
  });
  app.use(errorHandler);
  return app;
}
