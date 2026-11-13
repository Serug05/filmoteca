import { Router } from 'express';
import { GENRES } from '../constants.js';

export function genresRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ genres: Object.entries(GENRES).map(([value, label]) => ({ value, label })) });
  });

  return router;
}
