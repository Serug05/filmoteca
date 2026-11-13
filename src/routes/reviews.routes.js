import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadFilm, loadReview } from '../middleware/loaders.js';
import { validateBody } from '../middleware/validate.js';
import { ADMIN_ACTIONS, logModeration } from '../models/adminLog.js';
import { createReview, deleteReview, listReviewsForFilm, toReviewJson, updateReview } from '../models/reviews.js';
import { canManage, isAuthor } from '../services/permissions.js';
import { reviewSchema } from '../validation/review.schemas.js';

export function reviewsRouter({ db }) {
  const router = Router();

  router.get('/films/:filmId/reviews', loadFilm(db, 'filmId'), (req, res) => {
    res.json({ reviews: listReviewsForFilm(db, req.film.id).map(toReviewJson) });
  });

  // Autorul este utilizatorul din sesiune, iar filmul vine din URL; nimic din corpul cererii.
  router.post('/films/:filmId/reviews', requireAuth, loadFilm(db, 'filmId'), validateBody(reviewSchema), (req, res) => {
    let review;
    try {
      // Id-urile se pun DUPĂ datele din cerere, ca nimic din corp să nu le poată suprascrie.
      review = createReview(db, { ...req.body, filmId: req.film.id, userId: req.user.id });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Ai scris deja o recenzie pentru acest film. O poți edita.' });
      }
      throw err;
    }
    res.status(201).json({ review: toReviewJson(review) });
  });

  router.put('/reviews/:id', requireAuth, loadReview(db), validateBody(reviewSchema), (req, res) => {
    if (!isAuthor(req.user, req.review.user_id)) {
      return res.status(403).json({ error: 'Poți edita doar recenziile scrise de tine.' });
    }
    res.json({ review: toReviewJson(updateReview(db, req.review.id, req.body)) });
  });

  router.delete('/reviews/:id', requireAuth, loadReview(db), (req, res) => {
    if (!canManage(req.user, req.review.user_id)) {
      return res.status(403).json({ error: 'Poți șterge doar recenziile scrise de tine.' });
    }
    deleteReview(db, req.review.id);
    logModeration(db, req.user, req.review.user_id, {
      action: ADMIN_ACTIONS.DELETE_REVIEW,
      targetType: 'review',
      targetId: req.review.id,
      details: `${req.review.author_username}: ${req.review.body}`,
    });
    res.status(204).end();
  });

  return router;
}
