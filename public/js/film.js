import { api } from './api.js';
import { canManage, element, formatDate, formatDay, idFromQuery, posterElement, ratingSummary, stars } from './components.js';
import { clearErrors, setBusy, showErrors } from './forms.js';
import { renderNav } from './nav.js';

const filmId = idFromQuery();
const pageError = document.querySelector('[data-page-error]');
const reviewsError = document.querySelector('[data-reviews-error]');
const reviewForm = document.querySelector('[data-review-form]');
const cancelEdit = document.querySelector('[data-review-cancel]');

let user = null;
let editingReviewId = null;

// ---------- Filmul ----------

function renderFilm(film) {
  document.title = `${film.title} · Filmoteca`;
  document.querySelector('[data-poster]').replaceChildren(posterElement(film, 'poster-large'));

  // Fundalul paginii: posterul, mărit și estompat.
  const backdrop = document.querySelector('[data-backdrop]');
  if (film.posterUrl) {
    const image = document.createElement('img');
    image.src = film.posterUrl;
    image.alt = '';
    backdrop.replaceChildren(image);
  } else {
    backdrop.replaceChildren();
  }
  document.querySelector('[data-title]').textContent = film.title;
  document.querySelector('[data-meta]').textContent = `${film.year} · ${film.genreLabel}`;
  document.querySelector('[data-rating]').textContent = ratingSummary(film.rating);
  document.querySelector('[data-description]').textContent = film.description || 'Fără descriere.';
  document.querySelector('[data-owner]').textContent = film.owner.username;

  // Butoanele apar doar pentru proprietar și admin. E doar pentru confort:
  // serverul verifică din nou permisiunile la fiecare cerere.
  const actions = document.querySelector('[data-actions]');
  actions.hidden = !canManage(user, film);
  document.querySelector('[data-edit]').href = `/film-form.html?id=${film.id}`;

  document.querySelector('[data-film]').hidden = false;
}

async function deleteFilm() {
  const title = document.querySelector('[data-title]').textContent;
  if (!confirm(`Ștergi definitiv filmul „${title}”?`)) return;
  pageError.textContent = '';
  try {
    await api(`/films/${filmId}`, { method: 'DELETE' });
    location.replace('/');
  } catch (error) {
    pageError.textContent = error.message;
  }
}

// ---------- Lista mea (privată) ----------

const watch = {
  box: document.querySelector('[data-watch]'),
  state: document.querySelector('[data-watch-state]'),
  add: document.querySelector('[data-watch-add]'),
  seen: document.querySelector('[data-watch-seen]'),
  link: document.querySelector('[data-watch-link]'),
  error: document.querySelector('[data-watch-error]'),
};
let watchEntry = null;

function renderWatch() {
  if (!watchEntry) {
    watch.state.textContent = 'Filmul nu este în lista ta.';
  } else if (watchEntry.status === 'vazut') {
    watch.state.textContent = `În lista ta: văzut pe ${formatDay(watchEntry.watchedOn)}.`;
  } else {
    watch.state.textContent = 'În lista ta: de văzut.';
  }
  watch.add.hidden = Boolean(watchEntry);
  watch.seen.hidden = watchEntry?.status === 'vazut';
  watch.link.hidden = !watchEntry;
  watch.box.hidden = false;
}

async function loadWatch() {
  if (!user) return;
  const { entries } = await api(`/me/watchlist?film=${filmId}`);
  watchEntry = entries[0] ?? null;
  renderWatch();
}

async function updateWatch(status) {
  watch.error.textContent = '';
  try {
    const { entry } = watchEntry
      ? await api(`/me/watchlist/${watchEntry.id}`, { method: 'PUT', body: { status, note: watchEntry.note } })
      : await api('/me/watchlist', { method: 'POST', body: { filmId, status } });
    watchEntry = entry;
    renderWatch();
  } catch (error) {
    watch.error.textContent = error.message;
  }
}

// ---------- Recenziile ----------

function reviewItem(review) {
  const item = element('li', 'review');

  const header = element('div', 'review-header');
  const date = formatDate(review.createdAt) + (review.edited ? ' · editată' : '');
  header.append(element('strong', '', review.author.username), stars(review.rating), element('span', 'muted', date));

  item.append(header, element('p', 'review-body', review.body));

  const isAuthor = user?.id === review.author.id;
  const actions = element('div', 'review-actions');
  if (isAuthor) {
    const edit = element('button', 'btn btn-ghost btn-small', 'Editează');
    edit.type = 'button';
    edit.addEventListener('click', () => startEditing(review));
    actions.append(edit);
  }
  if (isAuthor || user?.role === 'admin') {
    const remove = element('button', 'btn btn-danger btn-small', 'Șterge');
    remove.type = 'button';
    remove.addEventListener('click', () => deleteReview(review));
    actions.append(remove);
  }
  if (actions.childElementCount) item.append(actions);
  return item;
}

function showForm(mode) {
  clearErrors(reviewForm);
  reviewForm.hidden = mode === 'hidden';
  cancelEdit.hidden = mode !== 'edit';
  document.querySelector('[data-review-form-title]').textContent =
    mode === 'edit' ? 'Editează recenzia' : 'Scrie o recenzie';
  reviewForm.querySelector('button[type="submit"]').textContent =
    mode === 'edit' ? 'Salvează modificările' : 'Publică recenzia';
}

function startEditing(review) {
  editingReviewId = review.id;
  reviewForm.elements.rating.value = String(review.rating);
  reviewForm.elements.body.value = review.body;
  showForm('edit');
  reviewForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderReviews(reviews) {
  document.querySelector('[data-review-list]').replaceChildren(...reviews.map(reviewItem));
  document.querySelector('[data-reviews-empty]').hidden = reviews.length > 0;

  const hasOwnReview = reviews.some((review) => review.author.id === user?.id);
  document.querySelector('[data-review-login]').hidden = Boolean(user);

  editingReviewId = null;
  reviewForm.reset();
  showForm(user && !hasOwnReview ? 'create' : 'hidden');

  document.querySelector('[data-reviews]').hidden = false;
}

async function refresh() {
  const [{ film }, { reviews }] = await Promise.all([
    api(`/films/${filmId}`),
    api(`/films/${filmId}/reviews`),
  ]);
  renderFilm(film);
  renderReviews(reviews);
}

async function saveReview(event) {
  event.preventDefault();
  clearErrors(reviewForm);
  reviewsError.textContent = '';

  const { rating, body } = reviewForm.elements;
  const payload = { rating: rating.value === '' ? null : Number(rating.value), body: body.value };

  setBusy(reviewForm, true);
  try {
    if (editingReviewId) {
      await api(`/reviews/${editingReviewId}`, { method: 'PUT', body: payload });
    } else {
      await api(`/films/${filmId}/reviews`, { method: 'POST', body: payload });
    }
    await refresh();
  } catch (error) {
    showErrors(reviewForm, error);
  } finally {
    setBusy(reviewForm, false);
  }
}

async function deleteReview(review) {
  if (!confirm('Ștergi definitiv această recenzie?')) return;
  reviewsError.textContent = '';
  try {
    await api(`/reviews/${review.id}`, { method: 'DELETE' });
    await refresh();
  } catch (error) {
    reviewsError.textContent = error.message;
  }
}

// ---------- Pornire ----------

async function main() {
  user = await renderNav();
  document.querySelector('[data-delete]').addEventListener('click', deleteFilm);
  reviewForm.addEventListener('submit', saveReview);
  cancelEdit.addEventListener('click', () => refresh().catch((error) => { reviewsError.textContent = error.message; }));
  watch.add.addEventListener('click', () => updateWatch('de_vazut'));
  watch.seen.addEventListener('click', () => updateWatch('vazut'));

  try {
    if (!filmId) throw new Error('Filmul nu există.');
    await refresh();
    await loadWatch();
  } catch (error) {
    pageError.textContent = error.message;
  }
}

main();
