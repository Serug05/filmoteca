import { api } from './api.js';

// Fundal decorativ: un perete înclinat de postere din catalog. Imaginile sunt doar decor,
// de aceea au text alternativ gol, iar containerul are aria-hidden în HTML.
export function renderCollage(container, films) {
  const sources = [...new Set(films.map((film) => film.posterUrl).filter(Boolean))];
  if (!container || !sources.length) return;

  const tiles = Array.from({ length: 40 }, (_, i) => sources[(i * 7) % sources.length]);
  container.replaceChildren(
    ...tiles.map((src) => {
      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.decoding = 'async';
      return image;
    }),
  );
}

// Pentru paginile care nu au deja filmele încărcate (autentificare, înregistrare).
export async function loadCollage(container) {
  try {
    const { films } = await api('/films?sort=rating');
    renderCollage(container, films);
  } catch {
    // Fundalul e doar decor: dacă nu se încarcă, pagina funcționează la fel.
  }
}
