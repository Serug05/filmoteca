import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { posterUpload } from '../middleware/upload.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createFilm,
  deleteFilm,
  findFilmById,
  isUsedByOthers,
  listFilms,
  setFilmPoster,
  toFilmJson,
  updateFilm,
} from '../models/films.js';
import { canManage, isAdmin } from '../services/permissions.js';
import { PosterError, processPoster, removePoster, savePoster } from '../services/posters.js';
import { parseId } from '../validation/common.js';
import { filmListQuerySchema, filmSchema } from '../validation/film.schemas.js';

const NOT_FOUND = { error: 'Filmul nu există.' };
const FORBIDDEN = { error: 'Poți modifica doar filmele adăugate de tine.' };
const USED_BY_OTHERS = {
  error: 'Filmul este folosit deja de alți utilizatori (recenzii sau liste), așa că doar un administrator îl mai poate șterge.',
};

export function filmsRouter({ db, postersDir }) {
  const router = Router();

  function loadFilm(req, res, next) {
    const id = parseId(req.params.id);
    const film = id && findFilmById(db, id);
    if (!film) return res.status(404).json(NOT_FOUND);
    req.film = film;
    next();
  }

  // Verificarea proprietarului (apărarea contra IDOR): rulează pe server la fiecare modificare,
  // indiferent ce butoane arată sau ascunde interfața.
  function requireManager(req, res, next) {
    if (!canManage(req.user, req.film.owner_id)) return res.status(403).json(FORBIDDEN);
    next();
  }

  router.get('/', validateQuery(filmListQuerySchema), (req, res) => {
    const { films, total, totalPages } = listFilms(db, req.validQuery);
    res.json({ films: films.map(toFilmJson), page: req.validQuery.page, total, totalPages });
  });

  router.get('/:id', loadFilm, (req, res) => {
    res.json({ film: toFilmJson(req.film) });
  });

  // Proprietarul este întotdeauna utilizatorul din sesiune, niciodată un câmp din cerere.
  router.post('/', requireAuth, validateBody(filmSchema), (req, res) => {
    const film = createFilm(db, req.user.id, req.body);
    res.status(201).json({ film: toFilmJson(film) });
  });

  router.put('/:id', requireAuth, loadFilm, requireManager, validateBody(filmSchema), (req, res) => {
    res.json({ film: toFilmJson(updateFilm(db, req.film.id, req.body)) });
  });

  router.delete('/:id', requireAuth, loadFilm, requireManager, async (req, res) => {
    if (!isAdmin(req.user) && isUsedByOthers(db, req.film.id, req.film.owner_id)) {
      return res.status(409).json(USED_BY_OTHERS);
    }
    deleteFilm(db, req.film.id);
    await removePoster(postersDir, req.film.poster);
    res.status(204).end();
  });

  // Permisiunile se verifică ÎNAINTE ca serverul să citească fișierul trimis.
  router.post('/:id/poster', requireAuth, loadFilm, requireManager, posterUpload, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Alege o imagine.', fields: { poster: 'Alege o imagine.' } });

    let poster;
    try {
      poster = await processPoster(req.file.buffer);
    } catch (err) {
      if (err instanceof PosterError) return res.status(400).json({ error: err.message, fields: { poster: err.message } });
      throw err;
    }

    const name = await savePoster(postersDir, poster);
    const film = setFilmPoster(db, req.film.id, name);
    await removePoster(postersDir, req.film.poster);
    res.json({ film: toFilmJson(film) });
  });

  return router;
}
