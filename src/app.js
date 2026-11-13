import path from 'node:path';
import express from 'express';
import { ROOT_DIR } from './config.js';
import { loadSession } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { createAuthLimiters } from './middleware/rateLimits.js';
import { crossOriginGuard, securityHeaders } from './middleware/security.js';
import { authRouter } from './routes/auth.routes.js';

// Construiește aplicația fără să o pornească; testele o folosesc direct, cu o bază de date în memorie.
export function createApp({ db, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders(config));

  // Doar folderul public/ este servit static, niciodată rădăcina proiectului (.env, baza de date).
  app.use(express.static(path.join(ROOT_DIR, 'public'), { dotfiles: 'ignore' }));

  const api = express.Router();
  api.use(crossOriginGuard);
  api.use(express.json({ limit: '20kb' }));
  api.use(loadSession(db));
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  api.use('/auth', authRouter({ db, config, limiters: createAuthLimiters() }));
  api.use(apiNotFound);

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
