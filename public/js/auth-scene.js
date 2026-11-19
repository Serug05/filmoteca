import { api } from './api.js';

// Pelicula 3D din spatele formularelor de autentificare. E doar decor: dacă browserul nu are
// WebGL sau încărcarea eșuează, pagina funcționează la fel, fără ea.
export async function startAuthScene3d() {
  const canvas = document.querySelector('[data-scene]');
  try {
    const [{ startAuthScene, supportsWebGL }, posterUrls] = await Promise.all([import('./scene3d.js'), loadPosterUrls()]);
    if (!supportsWebGL()) throw new Error('3D indisponibil');
    startAuthScene({ canvas, posterUrls });
  } catch {
    canvas.hidden = true;
  }
}

// Cadrele peliculei arată posterele filmelor din catalog (lista e publică).
// Dacă cererea eșuează, pelicula apare cu cadre goale.
async function loadPosterUrls() {
  try {
    const { films } = await api('/films?sort=rating');
    return films.map((film) => film.posterUrl).filter(Boolean);
  } catch {
    return [];
  }
}
