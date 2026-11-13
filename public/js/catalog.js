import { api } from './api.js';
import { filmCard, plural, renderPagination } from './components.js';
import { renderNav } from './nav.js';

const SORTS = ['recent', 'rating', 'year', 'title'];

const form = document.querySelector('[data-search-form]');
const grid = document.querySelector('[data-film-grid]');
const summary = document.querySelector('[data-catalog-summary]');
const pageError = document.querySelector('[data-page-error]');

async function loadGenres() {
  const { genres } = await api('/genres');
  for (const { value, label } of genres) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    form.elements.genre.append(option);
  }
  return genres.map((genre) => genre.value);
}

// Citim filtrele din adresă și păstrăm doar valorile care au sens.
// Serverul le validează oricum din nou.
function readFilters(genreValues) {
  const params = new URLSearchParams(location.search);
  const filters = {};

  const q = (params.get('q') ?? '').trim().slice(0, 100);
  if (q) filters.q = q;
  if (genreValues.includes(params.get('genre'))) filters.genre = params.get('genre');
  if (SORTS.includes(params.get('sort'))) filters.sort = params.get('sort');

  const page = params.get('page') ?? '';
  return { filters, page: /^[1-9]\d{0,3}$/.test(page) ? Number(page) : 1 };
}

function describeResults(total, filters) {
  if (!filters.q && !filters.genre) return total ? plural(total, 'film', 'filme') : 'Catalogul este încă gol.';

  const found = total ? plural(total, 'rezultat', 'rezultate') : 'Niciun rezultat';
  return filters.q ? `${found} pentru „${filters.q}”` : found;
}

async function main() {
  const user = await renderNav();
  document.querySelector('[data-add-film]').hidden = !user;

  try {
    const genreValues = await loadGenres();
    const { filters, page } = readFilters(genreValues);

    form.elements.q.value = filters.q ?? '';
    form.elements.genre.value = filters.genre ?? '';
    form.elements.sort.value = filters.sort ?? 'recent';

    const data = await api(`/films?${new URLSearchParams({ ...filters, page: String(page) })}`);
    grid.replaceChildren(...data.films.map(filmCard));
    summary.textContent = describeResults(data.total, filters);
    renderPagination(document.querySelector('[data-pagination]'), data.page, data.totalPages, filters);
  } catch (error) {
    pageError.textContent = error.message;
  }
}

main();
