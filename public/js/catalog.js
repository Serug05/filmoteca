import { api } from './api.js';
import { countFilms, filmCard, renderPagination } from './components.js';
import { renderNav } from './nav.js';

const user = await renderNav();
document.querySelector('[data-add-film]').hidden = !user;

const grid = document.querySelector('[data-film-grid]');
const summary = document.querySelector('[data-catalog-summary]');
const pageError = document.querySelector('[data-page-error]');

const requested = new URLSearchParams(location.search).get('page') ?? '';
const page = /^[1-9]\d{0,3}$/.test(requested) ? Number(requested) : 1;

try {
  const data = await api(`/films?page=${page}`);
  grid.replaceChildren(...data.films.map(filmCard));
  summary.textContent = data.total ? countFilms(data.total) : 'Catalogul este încă gol.';
  renderPagination(document.querySelector('[data-pagination]'), data.page, data.totalPages);
} catch (error) {
  pageError.textContent = error.message;
}
