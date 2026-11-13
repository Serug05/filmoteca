// Bucăți de interfață refolosite. Tot textul se pune cu textContent, niciodată cu innerHTML.

export const MAX_POSTER_BYTES = 2 * 1024 * 1024;

export function element(tag, className, text) {
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

// Pluralul în română: „1 film”, „5 filme”, „20 de filme”, „101 filme”.
export function plural(n, one, many) {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return n >= 20 && (rest === 0 || rest >= 20) ? `${n} de ${many}` : `${n} ${many}`;
}

export function stars(rating) {
  const node = element('span', 'stars', '★'.repeat(rating) + '☆'.repeat(5 - rating));
  node.setAttribute('aria-label', `${rating} din 5`);
  node.setAttribute('role', 'img');
  return node;
}

export function ratingSummary(rating) {
  if (!rating.count) return 'Fără recenzii';
  return `★ ${rating.average.toLocaleString('ro-RO')} · ${plural(rating.count, 'recenzie', 'recenzii')}`;
}

export function formatDate(sqliteDate) {
  return new Date(`${sqliteDate.replace(' ', 'T')}Z`).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// O zi calendaristică („2026-09-14”), afișată fără să fie mutată de fusul orar.
export function formatDay(isoDay) {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
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
    // Fără poster: un fundal colorat după gen, cu inițiala titlului.
    frame.classList.add('poster-empty');
    frame.dataset.genre = film.genre;
    frame.setAttribute('aria-hidden', 'true');
    frame.append(element('span', '', [...film.title.trim()][0]?.toUpperCase() ?? '?'));
  }
  return frame;
}

// Cardul din catalog: posterul pe toată suprafața, titlul peste un gradient închis, nota în colț.
export function filmCard(film) {
  const link = element('a', 'film-card');
  link.href = `/film.html?id=${encodeURIComponent(film.id)}`;

  const overlay = element('div', 'film-card-overlay');
  overlay.append(
    element('h3', 'film-card-title', film.title),
    element('p', 'film-card-meta', `${film.year} · ${film.genreLabel}`),
  );
  link.append(posterElement(film), overlay);

  if (film.rating.count) {
    const chip = element('span', 'rating-chip', `★ ${film.rating.average.toLocaleString('ro-RO')}`);
    chip.setAttribute('aria-label', `Nota medie ${film.rating.average} din 5, ${plural(film.rating.count, 'recenzie', 'recenzii')}`);
    link.append(chip);
  }

  const item = document.createElement('li');
  item.append(link);
  return item;
}

// Linkurile de paginare păstrează filtrele curente (căutare, gen, sortare).
export function renderPagination(container, page, totalPages, filters = {}) {
  container.replaceChildren();
  if (totalPages <= 1) return;

  const pageLink = (target, text) => {
    const link = element('a', 'btn btn-ghost', text);
    link.href = `?${new URLSearchParams({ ...filters, page: String(target) })}`;
    return link;
  };

  if (page > 1) container.append(pageLink(page - 1, '← Înapoi'));
  container.append(element('span', 'muted', `Pagina ${page} din ${totalPages}`));
  if (page < totalPages) container.append(pageLink(page + 1, 'Înainte →'));
}
