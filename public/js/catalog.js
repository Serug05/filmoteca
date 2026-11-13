import { api } from './api.js';
import { renderCollage } from './collage.js';
import { element, filmCard, plural, posterElement, renderPagination } from './components.js';
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

// Rândul „Cele mai apreciate”: primele 5 filme după nota medie, cu numere mari.
function topItem(film, index) {
  const rank = element('span', 'rank', String(index + 1));
  rank.setAttribute('aria-hidden', 'true');
  const figure = element('div', 'top-figure');
  figure.append(rank, posterElement(film));

  const link = element('a', 'top-link');
  link.href = `/film.html?id=${encodeURIComponent(film.id)}`;
  link.append(figure, element('span', 'top-title', film.title));

  const item = element('li', 'top-item');
  item.append(link);
  return item;
}

async function main() {
  const user = await renderNav();
  document.querySelector('[data-add-film]').hidden = !user;
  document.querySelector('[data-guest-note]').hidden = Boolean(user);

  try {
    const genreValues = await loadGenres();
    const { filters, page } = readFilters(genreValues);
    const browsing = Boolean(filters.q || filters.genre || filters.sort || page > 1);

    form.elements.q.value = filters.q ?? '';
    form.elements.genre.value = filters.genre ?? '';
    form.elements.sort.value = filters.sort ?? 'recent';
    document.querySelector('#hero-q').value = filters.q ?? '';

    const [data, best] = await Promise.all([
      api(`/films?${new URLSearchParams({ ...filters, page: String(page) })}`),
      api('/films?sort=rating'),
    ]);

    renderCollage(document.querySelector('[data-collage]'), best.films);

    const top = best.films.filter((film) => film.rating.count > 0).slice(0, 5);
    if (!browsing && top.length) {
      document.querySelector('[data-top-row]').replaceChildren(...top.map(topItem));
      document.querySelector('[data-top]').hidden = false;
    }

    grid.replaceChildren(...data.films.map(filmCard));
    summary.textContent = describeResults(data.total, filters);
    renderPagination(document.querySelector('[data-pagination]'), data.page, data.totalPages, filters);

    if (browsing) document.querySelector('#catalog').scrollIntoView();
  } catch (error) {
    pageError.textContent = error.message;
  }
}

main();
