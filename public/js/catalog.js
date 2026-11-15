import { api } from './api.js';
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

// Un rând din clasament: număr, titlu mare, detalii și posterul care apare la hover.
function rankRow(film, index) {
  const link = element('a', 'rank-row');
  link.href = `/film.html?id=${encodeURIComponent(film.id)}`;

  const thumb = element('span', 'rank-thumb');
  thumb.append(posterElement(film));
  link.append(
    element('span', 'rank-no', String(index + 1).padStart(2, '0')),
    element('span', 'rank-title', film.title),
    element('span', 'rank-meta', `${film.year} · ${film.genreLabel}`),
    element('span', 'rank-score', `★ ${film.rating.average.toLocaleString('ro-RO')}`),
    thumb,
  );

  const item = document.createElement('li');
  item.append(link);
  return item;
}

// Antetul e transparent peste secțiunea deschisă și devine închis după ce derulezi.
function watchHeader() {
  const header = document.querySelector('[data-header]');
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// Grafica 3D se încarcă separat: dacă browserul nu are WebGL sau ceva eșuează,
// pagina rămâne întreagă, doar cu trei postere statice în locul sferei.
async function start3d(films) {
  const canvas = document.querySelector('[data-scene]');
  const stage = document.querySelector('[data-stage]');
  const posterUrls = films.map((film) => film.posterUrl).filter(Boolean);

  try {
    const { startHomeScene, supportsWebGL } = await import('./scene3d.js');
    if (!supportsWebGL() || !posterUrls.length) throw new Error('3D indisponibil');
    startHomeScene({ canvas, stage, posterUrls });
  } catch {
    canvas.hidden = true;
    stage.classList.add('stage-fallback');
    stage.replaceChildren(...films.slice(0, 3).map((film) => posterElement(film)));
  }
}

async function main() {
  watchHeader();
  const user = await renderNav();
  document.querySelector('[data-add-film]').hidden = !user;
  for (const node of document.querySelectorAll('[data-guest-only]')) node.hidden = Boolean(user);
  if (user) {
    const cta = document.querySelector('[data-cta]');
    cta.href = '/lista-mea.html';
    cta.firstChild.textContent = 'Deschide lista mea ';
  }

  try {
    const genreValues = await loadGenres();
    const { filters, page } = readFilters(genreValues);
    const browsing = Boolean(filters.q || filters.genre || filters.sort || page > 1);

    form.elements.q.value = filters.q ?? '';
    form.elements.genre.value = filters.genre ?? '';
    form.elements.sort.value = filters.sort ?? 'recent';

    const [data, best] = await Promise.all([
      api(`/films?${new URLSearchParams({ ...filters, page: String(page) })}`),
      api('/films?sort=rating'),
    ]);

    document.querySelector('[data-film-count]').textContent = String(best.total);
    const top = best.films.filter((film) => film.rating.count > 0).slice(0, 5);
    document.querySelector('[data-top-row]').replaceChildren(...top.map(rankRow));

    grid.replaceChildren(...data.films.map(filmCard));
    summary.textContent = describeResults(data.total, filters);
    renderPagination(document.querySelector('[data-pagination]'), data.page, data.totalPages, filters);

    start3d(best.films);
    if (browsing) document.querySelector('#catalog').scrollIntoView();
  } catch (error) {
    pageError.textContent = error.message;
  }
}

main();
