import { api } from './api.js';
import { MAX_POSTER_BYTES, canManage, idFromQuery } from './components.js';
import { clearErrors, setBusy, showErrors } from './forms.js';
import { renderNav } from './nav.js';

const form = document.querySelector('[data-film-form]');
const heading = document.querySelector('[data-heading]');
const { title, year, genre, description, poster } = form.elements;

let filmId = idFromQuery();

function showEditMode(id) {
  filmId = id;
  history.replaceState(null, '', `/film-form.html?id=${id}`);
  heading.textContent = 'Editează filmul';
  document.title = 'Editează filmul · Filmoteca';
  document.querySelector('[data-cancel]').href = `/film.html?id=${id}`;
}

async function loadGenres() {
  const { genres } = await api('/genres');
  for (const { value, label } of genres) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    genre.append(option);
  }
}

async function loadFilmForEdit(user) {
  const { film } = await api(`/films/${filmId}`);
  if (!canManage(user, film)) {
    throw new Error('Poți modifica doar filmele adăugate de tine.');
  }
  showEditMode(film.id);
  title.value = film.title;
  year.value = film.year;
  genre.value = film.genre;
  description.value = film.description;
}

async function uploadPoster(id, file) {
  const data = new FormData();
  data.append('poster', file);
  await api(`/films/${id}/poster`, { method: 'POST', body: data });
}

async function save(event) {
  event.preventDefault();
  clearErrors(form);

  const file = poster.files[0];
  if (file && file.size > MAX_POSTER_BYTES) {
    showErrors(form, { fields: { poster: 'Fișierul depășește 2 MB.' } });
    return;
  }

  const body = {
    title: title.value,
    year: year.value === '' ? null : Number(year.value),
    genre: genre.value,
    description: description.value,
  };

  setBusy(form, true);
  try {
    const { film } = filmId
      ? await api(`/films/${filmId}`, { method: 'PUT', body })
      : await api('/films', { method: 'POST', body });

    // Dacă posterul eșuează, filmul e deja salvat: trecem pe editare, ca a doua încercare
    // să nu creeze un film duplicat.
    if (!filmId) showEditMode(film.id);
    if (file) await uploadPoster(film.id, file);

    location.replace(`/film.html?id=${film.id}`);
  } catch (error) {
    showErrors(form, error);
  } finally {
    setBusy(form, false);
  }
}

async function main() {
  const user = await renderNav();
  if (!user) {
    location.replace('/login.html');
    return;
  }

  try {
    await loadGenres();
    if (new URLSearchParams(location.search).has('id')) {
      if (!filmId) throw new Error('Filmul nu există.');
      await loadFilmForEdit(user);
    }
  } catch (error) {
    showErrors(form, error);
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  form.addEventListener('submit', save);
}

main();
