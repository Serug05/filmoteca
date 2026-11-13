import { api } from './api.js';

// Regulă pentru tot frontend-ul: textul venit de la server se pune în pagină doar cu
// textContent (niciodată cu innerHTML), ca browserul să nu-l interpreteze ca HTML.

function navLink(href, text) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  if (location.pathname === href) link.setAttribute('aria-current', 'page');
  return link;
}

export async function getCurrentUser() {
  try {
    const { user } = await api('/auth/me');
    return user;
  } catch {
    return null;
  }
}

export async function renderNav() {
  const nav = document.querySelector('[data-nav]');
  const user = await getCurrentUser();
  const items = [navLink('/', 'Catalog')];

  if (user) {
    const name = document.createElement('span');
    name.className = 'nav-user';
    name.textContent = user.username;

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'btn btn-ghost';
    logout.textContent = 'Ieșire';
    logout.addEventListener('click', async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } finally {
        location.replace('/');
      }
    });

    items.push(navLink('/film-form.html', 'Adaugă film'), name, logout);
  } else {
    items.push(navLink('/login.html', 'Intră în cont'), navLink('/register.html', 'Cont nou'));
  }

  nav.replaceChildren(...items);
  return user;
}
