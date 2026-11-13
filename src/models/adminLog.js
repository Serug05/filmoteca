import { ROLES } from '../constants.js';

// Jurnalul de audit: fiecare acțiune a unui administrator asupra datelor altcuiva lasă o urmă.

export const ADMIN_ACTIONS = Object.freeze({
  BLOCK_USER: 'block_user',
  UNBLOCK_USER: 'unblock_user',
  EDIT_FILM: 'edit_film',
  DELETE_FILM: 'delete_film',
  DELETE_REVIEW: 'delete_review',
});

export function logAdminAction(db, { adminId, action, targetType, targetId, details = '' }) {
  db.prepare('INSERT INTO admin_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, action, targetType, targetId, details.slice(0, 200));
}

// Folosită de rutele de filme și recenzii: scrie în jurnal doar când un admin
// modifică sau șterge ceva ce NU îi aparține (moderare).
export function logModeration(db, user, ownerId, entry) {
  if (user.role === ROLES.ADMIN && user.id !== ownerId) {
    logAdminAction(db, { adminId: user.id, ...entry });
  }
}

export function listAdminLog(db, limit = 50) {
  return db.prepare(`
    SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, u.username AS admin_username
    FROM admin_log l
    LEFT JOIN users u ON u.id = l.admin_id
    ORDER BY l.id DESC
    LIMIT ?
  `).all(limit);
}

export function toLogJson(entry) {
  return {
    id: entry.id,
    action: entry.action,
    target: { type: entry.target_type, id: entry.target_id },
    details: entry.details,
    admin: entry.admin_username ?? '(cont șters)',
    createdAt: entry.created_at,
  };
}
