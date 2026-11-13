import { api } from './api.js';
import { canManage, idFromQuery, posterElement } from './components.js';
import { renderNav } from './nav.js';

const user = await renderNav();
const pageError = document.querySelector('[data-page-error]');
const filmId = idFromQuery();

async function loadFilm() {
  if (!filmId) throw new Error('Filmul nu există.');
  const { film } = await api(`/films/${filmId}`);
  return film;
}

function render(film) {
  document.title = `${film.title} · Filmoteca`;
  document.querySelector('[data-poster]').replaceChildren(posterElement(film, 'poster-large'));
  document.querySelector('[data-title]').textContent = film.title;
  document.querySelector('[data-meta]').textContent = `${film.year} · ${film.genreLabel}`;
  document.querySelector('[data-description]').textContent = film.description || 'Fără descriere.';
  document.querySelector('[data-owner]').textContent = film.owner.username;

  // Butoanele apar doar pentru proprietar și admin. E doar pentru confort:
  // serverul verifică din nou permisiunile la fiecare cerere.
  if (canManage(user, film)) {
    document.querySelector('[data-actions]').hidden = false;
    document.querySelector('[data-edit]').href = `/film-form.html?id=${film.id}`;
    document.querySelector('[data-delete]').addEventListener('click', () => deleteFilm(film));
  }

  document.querySelector('[data-film]').hidden = false;
}

async function deleteFilm(film) {
  if (!confirm(`Ștergi definitiv filmul „${film.title}”?`)) return;
  pageError.textContent = '';
  try {
    await api(`/films/${film.id}`, { method: 'DELETE' });
    location.replace('/');
  } catch (error) {
    pageError.textContent = error.message;
  }
}

try {
  render(await loadFilm());
} catch (error) {
  pageError.textContent = error.message;
}
