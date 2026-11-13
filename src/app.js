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

// Construiește aplicația fără să o pornească; testele o folosesc direct, cu o bază de date în memorie.
export function createApp({ db, config }) {
  const postersDir = path.join(config.uploadsDir, 'posters');
  fs.mkdirSync(postersDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders(config));

  // Doar folderul public/ este servit static, niciodată rădăcina proiectului (.env, baza de date).
  app.use(express.static(path.join(ROOT_DIR, 'public'), { dotfiles: 'ignore' }));

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
