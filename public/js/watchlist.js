import { api } from './api.js';
import { element, formatDay, posterElement } from './components.js';
import { clearErrors, setBusy, showErrors } from './forms.js';
import { requireUser } from './nav.js';

const STATUSES = ['de_vazut', 'vazut'];
const list = document.querySelector('[data-watchlist]');
const pageError = document.querySelector('[data-page-error]');

const requested = new URLSearchParams(location.search).get('status');
const status = STATUSES.includes(requested) ? requested : '';

function button(text, className, onClick) {
  const node = element('button', `btn ${className} btn-small`, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function field(form, labelText, input) {
  const label = element('label', '', labelText);
  label.htmlFor = input.id;
  const error = element('p', 'field-error');
  error.dataset.errorFor = input.name;
  form.append(label, input, error);
}

// Formularul de editare al unei intrări, construit din cod (fără innerHTML).
function editForm(entry) {
  const form = element('form', 'entry-form');
  form.noValidate = true;

  const generalError = element('p', 'form-error');
  generalError.setAttribute('role', 'alert');
  generalError.dataset.formError = '';
  form.append(generalError);

  const select = Object.assign(document.createElement('select'), { name: 'status', id: `status-${entry.id}` });
  for (const [value, label] of [['de_vazut', 'De văzut'], ['vazut', 'Văzut']]) {
    select.append(Object.assign(document.createElement('option'), { value, textContent: label }));
  }
  select.value = entry.status;

  const date = Object.assign(document.createElement('input'), {
    type: 'date',
    name: 'watchedOn',
    id: `date-${entry.id}`,
    value: entry.watchedOn ?? '',
    max: new Date().toISOString().slice(0, 10),
  });

  const note = Object.assign(document.createElement('textarea'), {
    name: 'note',
    id: `note-${entry.id}`,
    rows: 3,
    maxLength: 500,
    value: entry.note,
  });

  field(form, 'Stare', select);
  field(form, 'Data vizionării (doar pentru filmele văzute)', date);
  field(form, 'Notiță privată', note);

  const actions = element('div', 'form-actions');
  const save = element('button', 'btn btn-primary btn-small', 'Salvează');
  save.type = 'submit';
  actions.append(save, button('Renunță', 'btn-ghost', () => load()));
  form.append(actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    setBusy(form, true);
    try {
      await saveEntry(entry.id, { status: select.value, watchedOn: date.value || null, note: note.value });
      await load();
    } catch (error) {
      showErrors(form, error);
      setBusy(form, false);
    }
  });
  return form;
}

function entryItem(entry) {
  const item = element('li', 'watch-item');

  const posterLink = element('a', 'watch-poster');
  posterLink.href = `/film.html?id=${entry.film.id}`;
  posterLink.append(posterElement(entry.film));

  const info = element('div', 'watch-info');
  const title = element('a', 'watch-title', entry.film.title);
  title.href = `/film.html?id=${entry.film.id}`;

  const badge = element(
    'span',
    `badge ${entry.status === 'vazut' ? 'badge-done' : ''}`,
    entry.status === 'vazut' ? `Văzut pe ${formatDay(entry.watchedOn)}` : 'De văzut',
  );

  info.append(
    title,
    element('p', 'muted', `${entry.film.year} · ${entry.film.genreLabel}`),
    badge,
    element('p', entry.note ? 'watch-note' : 'watch-note muted', entry.note || 'Fără notițe.'),
  );

  const actions = element('div', 'review-actions');
  if (entry.status === 'de_vazut') {
    actions.append(button('Am văzut filmul', 'btn-primary', () => quickUpdate(entry, 'vazut')));
  }
  actions.append(
    button('Editează', 'btn-ghost', () => info.replaceChildren(title, editForm(entry))),
    button('Scoate din listă', 'btn-danger', () => removeEntry(entry)),
  );
  info.append(actions);

  item.append(posterLink, info);
  return item;
}

function saveEntry(id, body) {
  return api(`/me/watchlist/${id}`, { method: 'PUT', body });
}

async function quickUpdate(entry, newStatus) {
  pageError.textContent = '';
  try {
    await saveEntry(entry.id, { status: newStatus, watchedOn: null, note: entry.note });
    await load();
  } catch (error) {
    pageError.textContent = error.message;
  }
}

async function removeEntry(entry) {
  if (!confirm(`Scoți „${entry.film.title}” din lista ta?`)) return;
  pageError.textContent = '';
  try {
    await api(`/me/watchlist/${entry.id}`, { method: 'DELETE' });
    await load();
  } catch (error) {
    pageError.textContent = error.message;
  }
}

async function load() {
  const query = status ? `?status=${status}` : '';
  const { entries } = await api(`/me/watchlist${query}`);
  list.replaceChildren(...entries.map(entryItem));
  document.querySelector('[data-empty]').hidden = entries.length > 0;
}

async function main() {
  if (!(await requireUser())) return;

  for (const tab of document.querySelectorAll('[data-tab]')) {
    if (tab.dataset.tab === status) tab.setAttribute('aria-current', 'page');
  }

  try {
    await load();
  } catch (error) {
    pageError.textContent = error.message;
  }
}

main();
