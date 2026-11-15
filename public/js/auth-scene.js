// Lanțul 3D din spatele formularelor de autentificare. E doar decor: dacă browserul nu are
// WebGL sau încărcarea eșuează, pagina funcționează la fel, fără el.
export async function startAuthScene3d() {
  const canvas = document.querySelector('[data-scene]');
  try {
    const { startAuthScene, supportsWebGL } = await import('./scene3d.js');
    if (!supportsWebGL()) throw new Error('3D indisponibil');
    startAuthScene({ canvas });
  } catch {
    canvas.hidden = true;
  }
}
