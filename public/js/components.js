// Bucăți de interfață refolosite. Tot textul se pune cu textContent, niciodată cu innerHTML.

export const MAX_POSTER_BYTES = 2 * 1024 * 1024;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Id-ul din adresă (?id=12), acceptat doar dacă e un număr întreg pozitiv.
export function idFromQuery() {
  const value = new URLSearchParams(location.search).get('id') ?? '';
  return /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
}

export function canManage(user, film) {
  return Boolean(user) && (user.role === 'admin' || user.id === film.owner.id);
}

export function posterElement(film, extraClass = '') {
  const frame = element('div', `poster ${extraClass}`.trim());

  if (film.posterUrl) {
    const image = document.createElement('img');
    image.src = film.posterUrl;
    image.alt = `Posterul filmului ${film.title}`;
    image.loading = 'lazy';
    frame.append(image);
  } else {
    frame.classList.add('poster-empty');
    frame.setAttribute('aria-hidden', 'true');
    frame.append(element('span', '', [...film.title.trim()][0]?.toUpperCase() ?? '?'));
  }
  return frame;
}

export function filmCard(film) {
  const link = element('a', 'film-card');
  link.href = `/film.html?id=${encodeURIComponent(film.id)}`;

  const body = element('div', 'film-card-body');
  body.append(element('h2', 'film-card-title', film.title), element('p', 'muted', `${film.year} · ${film.genreLabel}`));
  link.append(posterElement(film), body);

  const item = document.createElement('li');
  item.append(link);
  return item;
}

export function renderPagination(container, page, totalPages) {
  container.replaceChildren();
  if (totalPages <= 1) return;

  const pageLink = (target, text) => {
    const link = element('a', 'btn btn-ghost', text);
    link.href = `?page=${target}`;
    return link;
  };

  if (page > 1) container.append(pageLink(page - 1, '← Înapoi'));
  container.append(element('span', 'muted', `Pagina ${page} din ${totalPages}`));
  if (page < totalPages) container.append(pageLink(page + 1, 'Înainte →'));
}

// „1 film”, „5 filme”, „20 de filme”, „101 filme”.
export function countFilms(n) {
  if (n === 1) return '1 film';
  const rest = n % 100;
  return n >= 20 && (rest === 0 || rest >= 20) ? `${n} de filme` : `${n} filme`;
}
