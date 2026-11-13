export const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

export const SESSION_COOKIE = 'sid';

// Ordinile de sortare permise pentru catalog. Orice altă valoare e respinsă la validare.
export const FILM_SORTS = Object.freeze(['recent', 'rating', 'year', 'title']);

// Lista fixă de genuri: cheia se salvează în baza de date, eticheta se afișează.
export const GENRES = Object.freeze({
  actiune: 'Acțiune',
  animatie: 'Animație',
  comedie: 'Comedie',
  documentar: 'Documentar',
  drama: 'Dramă',
  fantasy: 'Fantasy',
  horror: 'Horror',
  romantic: 'Romantic',
  sf: 'SF',
  thriller: 'Thriller',
});
