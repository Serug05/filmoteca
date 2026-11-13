import { findFilmById } from '../models/films.js';
import { findReviewById } from '../models/reviews.js';
import { parseId } from '../validation/common.js';

// Încarcă înregistrarea cerută în URL sau răspunde 404. Rutele de după primesc req.film / req.review.

export function loadFilm(db, param = 'id') {
  return (req, res, next) => {
    const id = parseId(req.params[param]);
    const film = id && findFilmById(db, id);
    if (!film) return res.status(404).json({ error: 'Filmul nu există.' });
    req.film = film;
    next();
  };
}

export function loadReview(db) {
  return (req, res, next) => {
    const id = parseId(req.params.id);
    const review = id && findReviewById(db, id);
    if (!review) return res.status(404).json({ error: 'Recenzia nu există.' });
    req.review = review;
    next();
  };
}
