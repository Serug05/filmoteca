import { ROLES } from '../constants.js';

// Regula de bază a aplicației: modifici doar ce îți aparține; administratorul poate modera orice.
// Toate rutele care editează sau șterg trec prin aceste funcții.
export function canManage(user, ownerId) {
  return Boolean(user) && (user.role === ROLES.ADMIN || user.id === ownerId);
}

// Textul unei recenzii îl poate schimba doar autorul ei. Adminul o poate șterge,
// dar nu poate scrie în numele altcuiva.
export function isAuthor(user, authorId) {
  return Boolean(user) && user.id === authorId;
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}
