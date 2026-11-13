// Generează postere ORIGINALE (artă abstractă, fără text) pentru filmele demo, ca să nu folosim
// postere reale, protejate de drepturi de autor. Fiecare poster e unic: culorile vin din gen,
// iar formele din titlu (același titlu dă mereu același poster).

const PALETTES = {
  actiune: ['#ff6a3d', '#c81d25', '#2b0a0a'],
  animatie: ['#4fd1c5', '#3b82f6', '#0f1e3d'],
  comedie: ['#ffd166', '#f77f00', '#3a1c05'],
  documentar: ['#a3b18a', '#588157', '#132a13'],
  drama: ['#b388eb', '#5a189a', '#10002b'],
  fantasy: ['#d4af37', '#2d6a4f', '#081c15'],
  horror: ['#e5383b', '#660708', '#0b090a'],
  romantic: ['#ff8fab', '#c9184a', '#2b0a14'],
  sf: ['#4cc9f0', '#4361ee', '#0b0c2a'],
  thriller: ['#90a4ae', '#37474f', '#0d1316'],
};

// Generator pseudo-aleator determinist (mulberry32), pornit dintr-un hash al titlului.
function randomFrom(text) {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.codePointAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function posterSvg({ title, genre }) {
  const [light, mid, dark] = PALETTES[genre] ?? PALETTES.drama;
  const rand = randomFrom(`${title}|${genre}`);
  const between = (min, max) => min + rand() * (max - min);
  const W = 600;
  const H = 900;

  const orbs = Array.from({ length: 4 }, (_, i) =>
    `<circle cx="${between(-50, W + 50).toFixed(0)}" cy="${between(80, H - 150).toFixed(0)}" r="${between(140, 320).toFixed(0)}" fill="url(#orb${i % 2})" opacity="${between(0.35, 0.75).toFixed(2)}"/>`,
  ).join('');

  const angle = between(-35, 35).toFixed(1);
  const beams = Array.from({ length: 3 }, () => {
    const x = between(0, W).toFixed(0);
    const w = between(30, 120).toFixed(0);
    return `<rect x="${x}" y="-200" width="${w}" height="${H + 400}" fill="url(#beam)" opacity="${between(0.15, 0.4).toFixed(2)}" transform="rotate(${angle} ${W / 2} ${H / 2})"/>`;
  }).join('');

  const stars = genre === 'sf' || genre === 'fantasy'
    ? Array.from({ length: 60 }, () => `<circle cx="${between(0, W).toFixed(0)}" cy="${between(0, H * 0.7).toFixed(0)}" r="${between(0.6, 2.2).toFixed(1)}" fill="#fff" opacity="${between(0.3, 0.9).toFixed(2)}"/>`).join('')
    : '';

  // Trei compoziții posibile, alese după titlu: răsărit peste orizont, planetă cu inel, munți în straturi.
  const horizonY = Number(between(H * 0.55, H * 0.75).toFixed(0));
  const sunR = Number(between(70, 150).toFixed(0));
  const sunX = Number(between(W * 0.25, W * 0.75).toFixed(0));
  const motif = Math.floor(rand() * 3);

  const sunrise = `
  <circle cx="${sunX}" cy="${horizonY}" r="${sunR * 2}" fill="url(#sun)" opacity="0.85"/>
  <path d="M0 ${horizonY} Q ${W * 0.3} ${(horizonY - between(20, 90)).toFixed(0)} ${W * 0.55} ${(horizonY + between(-10, 30)).toFixed(0)} T ${W} ${(horizonY - between(0, 60)).toFixed(0)} V ${H} H 0 Z" fill="url(#ground)"/>`;

  const ringY = between(H * 0.3, H * 0.5).toFixed(0);
  const ringR = between(120, 190).toFixed(0);
  const ring = `
  <circle cx="${sunX}" cy="${ringY}" r="${ringR}" fill="url(#planet)"/>
  <ellipse cx="${sunX}" cy="${ringY}" rx="${(ringR * 1.7).toFixed(0)}" ry="${(ringR * 0.32).toFixed(0)}" fill="none" stroke="${light}" stroke-width="${between(4, 10).toFixed(0)}" opacity="0.7" transform="rotate(${between(-25, 25).toFixed(0)} ${sunX} ${ringY})"/>
  <rect y="${horizonY + 60}" width="${W}" height="${H}" fill="url(#ground)"/>`;

  const ridges = [0.62, 0.72, 0.82].map((level, layer) => {
    const points = Array.from({ length: 7 }, (_, i) => `${(i * W) / 6},${(H * level - between(30, 160)).toFixed(0)}`).join(' L ');
    return `<path d="M0 ${H} L ${points} L ${W} ${H} Z" fill="${dark}" opacity="${(0.55 + layer * 0.2).toFixed(2)}"/>`;
  }).join('');
  const mountains = `
  <circle cx="${sunX}" cy="${(H * 0.32).toFixed(0)}" r="${(sunR * 0.6).toFixed(0)}" fill="${light}" opacity="0.9"/>
  <circle cx="${sunX}" cy="${(H * 0.32).toFixed(0)}" r="${(sunR * 1.6).toFixed(0)}" fill="url(#sun)" opacity="0.5"/>
  ${ridges}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${mid}"/>
      <stop offset="0.55" stop-color="${dark}"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <radialGradient id="orb0"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient>
    <radialGradient id="orb1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${light}"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="sun"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="${light}"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
    <radialGradient id="planet" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${light}"/><stop offset="0.6" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${dark}" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.75"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${Math.floor(between(1, 999))}"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${stars}
  ${orbs}
  ${beams}
  ${[sunrise, ring, mountains][motif]}
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.08"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;
}
