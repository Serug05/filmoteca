import { api } from './api.js';
import { element, formatDate, stars } from './components.js';
import { requireUser } from './nav.js';

// Pagina e doar o interfață peste /api/admin. Siguranța nu depinde de ea:
// fiecare rută /api/admin verifică pe server că utilizatorul are rolul admin.

const ACTION_LABELS = {
  block_user: 'a blocat utilizatorul',
  unblock_user: 'a deblocat utilizatorul',
  edit_film: 'a editat filmul',
  delete_film: 'a șters filmul',
  delete_review: 'a șters recenzia',
};

const state = { me: null, userQuery: '', userPage: 1, reviewPage: 1 };

function button(text, className, onClick) {
  const node = element('button', `btn ${className} btn-small`, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function pager(container, page, totalPages, onChange) {
  container.replaceChildren();
  if (totalPages <= 1) return;
  if (page > 1) container.append(button('← Înapoi', 'btn-ghost', () => onChange(page - 1)));
  container.append(element('span', 'muted', `Pagina ${page} din ${totalPages}`));
  if (page < totalPages) container.append(button('Înainte →', 'btn-ghost', () => onChange(page + 1)));
}

// ---------- Raport ----------

async function loadStats() {
  const { stats } = await api('/admin/stats');
  const totals = [
    ['Utilizatori', stats.totals.users],
    ['Administratori', stats.totals.admins],
    ['Conturi blocate', stats.totals.blocked],
    ['Filme', stats.totals.films],
    ['Recenzii', stats.totals.reviews],
    ['Intrări în liste', stats.totals.watchlistEntries],
  ];
  document.querySelector('[data-totals]').replaceChildren(
    ...totals.map(([label, value]) => {
      const item = element('li', 'stat');
      item.append(element('strong', '', String(value)), element('span', 'muted', label));
      return item;
    }),
  );

  document.querySelector('[data-top-films]').replaceChildren(
    ...stats.topFilms.map((film) => {
      const item = document.createElement('li');
      const link = element('a', '', film.title);
      link.href = `/film.html?id=${film.id}`;
      item.append(link, element('span', 'muted', ` · ★ ${film.average} (${film.count})`));
      return item;
    }),
  );

  document.querySelector('[data-top-reviewers]').replaceChildren(
    ...stats.topReviewers.map((reviewer) => element('li', '', `${reviewer.username} · ${reviewer.count}`)),
  );
}

// ---------- Utilizatori ----------

function userRow(user) {
  const row = document.createElement('tr');
  const cell = (text, className) => element('td', className, text);

  const status = element('span', `badge ${user.isBlocked ? 'badge-blocked' : 'badge-done'}`, user.isBlocked ? 'Blocat' : 'Activ');
  const statusCell = document.createElement('td');
  statusCell.append(status);

  const actions = document.createElement('td');
  if (user.role !== 'admin' && user.id !== state.me.id) {
    actions.append(
      user.isBlocked
        ? button('Deblochează', 'btn-ghost', () => setBlocked(user, false))
        : button('Blochează', 'btn-danger', () => setBlocked(user, true)),
    );
  }

  row.append(
    cell(user.username, 'strong-cell'),
    cell(user.email),
    cell(user.role === 'admin' ? 'Administrator' : 'Utilizator'),
    cell(String(user.films)),
    cell(String(user.reviews)),
    statusCell,
    actions,
  );
  return row;
}

async function loadUsers() {
  const params = new URLSearchParams({ page: String(state.userPage) });
  if (state.userQuery) params.set('q', state.userQuery);
  const data = await api(`/admin/users?${params}`);

  document.querySelector('[data-users]').replaceChildren(...data.users.map(userRow));
  pager(document.querySelector('[data-users-pagination]'), data.page, data.totalPages, (page) => {
    state.userPage = page;
    loadUsers().catch(showUsersError);
  });
}

function showUsersError(error) {
  document.querySelector('[data-users-error]').textContent = error.message;
}

async function setBlocked(user, blocked) {
  const question = blocked
    ? `Blochezi contul „${user.username}”? Toate sesiunile lui se închid imediat.`
    : `Deblochezi contul „${user.username}”?`;
  if (!confirm(question)) return;

  document.querySelector('[data-users-error]').textContent = '';
  try {
    await api(`/admin/users/${user.id}`, { method: 'PATCH', body: { blocked } });
    await Promise.all([loadUsers(), loadStats(), loadLog()]);
  } catch (error) {
    showUsersError(error);
  }
}

// ---------- Recenzii recente ----------

function adminReviewItem(review) {
  const item = element('li', 'review');
  const header = element('div', 'review-header');
  const filmLink = element('a', '', review.film.title);
  filmLink.href = `/film.html?id=${review.film.id}`;
  header.append(element('strong', '', review.author), stars(review.rating), filmLink, element('span', 'muted', formatDate(review.createdAt)));

  const actions = element('div', 'review-actions');
  actions.append(button('Șterge recenzia', 'btn-danger', () => deleteReview(review)));
  item.append(header, element('p', 'review-body', review.body), actions);
  return item;
}

async function loadReviews() {
  const data = await api(`/admin/reviews?page=${state.reviewPage}`);
  document.querySelector('[data-admin-reviews]').replaceChildren(...data.reviews.map(adminReviewItem));
  pager(document.querySelector('[data-reviews-pagination]'), data.page, data.totalPages, (page) => {
    state.reviewPage = page;
    loadReviews().catch(showReviewsError);
  });
}

function showReviewsError(error) {
  document.querySelector('[data-reviews-error]').textContent = error.message;
}

async function deleteReview(review) {
  if (!confirm(`Ștergi recenzia lui ${review.author} la „${review.film.title}”?`)) return;
  document.querySelector('[data-reviews-error]').textContent = '';
  try {
    await api(`/reviews/${review.id}`, { method: 'DELETE' });
    await Promise.all([loadReviews(), loadStats(), loadLog()]);
  } catch (error) {
    showReviewsError(error);
  }
}

// ---------- Jurnal ----------

async function loadLog() {
  const { entries } = await api('/admin/log');
  document.querySelector('[data-log-empty]').hidden = entries.length > 0;
  document.querySelector('[data-log]').replaceChildren(
    ...entries.map((entry) => {
      const item = element('li', 'log-item');
      item.append(
        element('span', 'muted', formatDate(entry.createdAt)),
        element('span', '', `${entry.admin} ${ACTION_LABELS[entry.action] ?? entry.action}`),
        element('span', 'log-details', entry.details),
      );
      return item;
    }),
  );
}

// ---------- Pornire ----------

async function main() {
  state.me = await requireUser();
  if (!state.me) return;
  if (state.me.role !== 'admin') {
    location.replace('/');
    return;
  }

  document.querySelector('[data-user-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    state.userQuery = event.target.elements.q.value.trim().slice(0, 100);
    state.userPage = 1;
    loadUsers().catch(showUsersError);
  });

  try {
    await Promise.all([loadStats(), loadUsers(), loadReviews(), loadLog()]);
    document.querySelector('[data-admin]').hidden = false;
  } catch (error) {
    document.querySelector('[data-page-error]').textContent = error.message;
  }
}

main();
