import { Router } from 'express';
import { ROLES } from '../constants.js';
import { requireRole } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { findAdminUser, getStats, listRecentReviews, listUsers, setUserBlocked, toAdminUserJson } from '../models/admin.js';
import { ADMIN_ACTIONS, listAdminLog, logAdminAction, toLogJson } from '../models/adminLog.js';
import { deleteUserSessions } from '../models/sessions.js';
import { parseId } from '../validation/common.js';
import { adminUsersQuerySchema, blockUserSchema, pageQuerySchema } from '../validation/admin.schemas.js';

export function adminRouter({ db }) {
  const router = Router();

  // O singură verificare pentru TOATE rutele de mai jos: fără rolul admin, răspunsul e 401/403,
  // indiferent dacă interfața afișează sau nu pagina de administrare.
  router.use(requireRole(ROLES.ADMIN));

  router.get('/stats', (req, res) => {
    res.json({ stats: getStats(db) });
  });

  router.get('/users', validateQuery(adminUsersQuerySchema), (req, res) => {
    const { users, total, totalPages } = listUsers(db, req.validQuery);
    res.json({ users: users.map(toAdminUserJson), page: req.validQuery.page, total, totalPages });
  });

  // Blocarea unui cont închide imediat toate sesiunile lui și se trece în jurnal.
  // Un admin nu se poate bloca singur și nu poate bloca alți administratori.
  router.patch('/users/:id', validateBody(blockUserSchema), (req, res) => {
    const id = parseId(req.params.id);
    const target = id && findAdminUser(db, id);
    if (!target) return res.status(404).json({ error: 'Utilizatorul nu există.' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Nu îți poți bloca propriul cont.' });
    if (target.role === ROLES.ADMIN) return res.status(403).json({ error: 'Nu poți bloca un alt administrator.' });

    const { blocked } = req.body;
    db.transaction(() => {
      setUserBlocked(db, target.id, blocked);
      if (blocked) deleteUserSessions(db, target.id);
      logAdminAction(db, {
        adminId: req.user.id,
        action: blocked ? ADMIN_ACTIONS.BLOCK_USER : ADMIN_ACTIONS.UNBLOCK_USER,
        targetType: 'user',
        targetId: target.id,
        details: target.username,
      });
    })();

    res.json({ user: toAdminUserJson(findAdminUser(db, target.id)) });
  });

  router.get('/reviews', validateQuery(pageQuerySchema), (req, res) => {
    res.json({ page: req.validQuery.page, ...listRecentReviews(db, req.validQuery) });
  });

  router.get('/log', (req, res) => {
    res.json({ entries: listAdminLog(db).map(toLogJson) });
  });

  return router;
}
