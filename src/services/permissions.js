import { ROLES } from '../constants.js';

// Regula de bază a aplicației: modifici doar ce îți aparține; administratorul poate modera orice.
// Toate rutele care editează sau șterg trec prin această funcție.
export function canManage(user, ownerId) {
  return Boolean(user) && (user.role === ROLES.ADMIN || user.id === ownerId);
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}
