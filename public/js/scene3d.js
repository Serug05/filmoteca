// Grafica 3D (doar decor).
// Prima pagină: o sferă lucioasă în mijloc, înconjurată de o bandă de film retro pe orbită.
// Autentificarea: aceeași peliculă, ca o panglică ce șerpuiește prin pagină în spatele formularului.
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from '/vendor/three/three.module.js';

const FOV = 35;

export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = () => window.innerWidth < 700;

// Poziția unui element în pagină (nu pe ecran).
function pageBox(element) {
  const rect = element.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  return { top, bottom: top + rect.height, height: rect.height, centerX: rect.left + rect.width / 2, width: rect.width };
}

// Coordonatele 3D sunt pixeli din pagină: x față de mijlocul ecranului, iar y în jos devine y negativ.
const toWorld = ([x, y, z]) => new Vector3(x, -y, z);

// Un „studio” virtual: o cameră gri cu panouri luminoase. Sfera îl reflectă;
// fără el, metalul ar ieși negru.
function studioEnvironment(renderer) {
  const studio = new Scene();
  studio.add(new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial({ color: new Color(0.32, 0.32, 0.36), side: BackSide })));

  const panels = [
    [6, 2, 3.2, [0, 4.9, 0]],
    [3, 4, 2.4, [-4.9, 0.5, 1]],
    [3, 4, 1.8, [4.9, 1, -1]],
    [4, 1.5, 2.8, [0, 1, 4.9]],
    [2, 2, 1.2, [0, -1, -4.9]],
  ];
  for (const [width, height, intensity, position] of panels) {
    const panel = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ color: new Color(intensity, intensity, intensity), side: DoubleSide }),
    );
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studio, 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Motorul comun: randare, lumini și camera care urmărește scroll-ul.
function createStage(canvas, build) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  scene.environment = studioEnvironment(renderer);
  scene.add(new AmbientLight('#ffffff', 0.6));
  const keyLight = new DirectionalLight('#ffffff', 1.3);
  keyLight.position.set(300, 500, 600);
  scene.add(keyLight);
  const rimLight = new DirectionalLight('#ffffff', 0.8);
  rimLight.position.set(-400, 200, -500);
  scene.add(rimLight);

  const camera = new PerspectiveCamera(FOV, 1, 1, 6000);
  const still = reducedMotion();
  // `invalidate` cere un cadru nou, de exemplu când posterele au ajuns în textură.
  const parts = build({ scene, still, invalidate: () => requestRender() });

  const clock = { elapsed: 0 };
  let viewport = { width: 1, height: 1 };

  function layout() {
    viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen() ? 1 : 1.75));
    renderer.setSize(viewport.width, viewport.height, false);
    camera.aspect = viewport.width / viewport.height;
    camera.position.z = viewport.height / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.updateProjectionMatrix();
    parts.layout(viewport);
  }

  function update(delta) {
    if (!still) clock.elapsed += delta;
    camera.position.set(0, -(window.scrollY + viewport.height / 2), camera.position.z);
    parts.update({ time: clock.elapsed, scrollY: window.scrollY });
  }

  let last = performance.now();
  let scheduled = false;
  function render(now = performance.now()) {
    scheduled = false;
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(delta);
    renderer.render(scene, camera);
    if (!still) requestAnimationFrame(render);
  }
  function requestRender() {
    if (still && !scheduled) {
      scheduled = true;
      requestAnimationFrame(render);
    }
  }

  let relayoutPending = false;
  function relayout() {
    if (relayoutPending) return;
    relayoutPending = true;
    requestAnimationFrame(() => {
      relayoutPending = false;
      layout();
      requestRender();
    });
  }

  layout();
  window.addEventListener('resize', relayout);
  new ResizeObserver(relayout).observe(document.body);
  window.addEventListener('scroll', requestRender, { passive: true });
  canvas.classList.add('is-ready');
  render();
}

// ---------- Pelicula retro (prima pagină și autentificarea) ----------

// Banda de film retro: o peliculă de 35 mm desenată într-un canvas 2D și folosită ca textură.
// Cadrele sunt posterele filmelor (în tonuri sepia), cu perforații pe margini, marcaje portocalii,
// zgârieturi, praf și granulație. Perforațiile sunt tăiate (transparente), nu doar desenate.
const FILM = { frames: 16, cell: 250, frameWidth: 225, frameHeight: 150, height: 256, holePitch: 37.5 };

// Numere pseudo-aleatoare cu sămânță fixă: zgârieturile și praful arată la fel la fiecare încărcare.
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function drawFilmStrip(ctx, images) {
  const { frames, cell, frameWidth, frameHeight, height, holePitch } = FILM;
  const width = frames * cell;
  const frameY = (height - frameHeight) / 2;
  const random = seededRandom(19);

  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);

  // Pelicula: acetat maro-chihlimbar, puțin mai deschis spre margini.
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#6b3e16');
  base.addColorStop(0.5, '#3b2210');
  base.addColorStop(1, '#6b3e16');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < frames; i += 1) {
    const x = i * cell + (cell - frameWidth) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, frameY, frameWidth, frameHeight, 10);
    ctx.clip();
    ctx.fillStyle = '#140b05';
    ctx.fillRect(x, frameY, frameWidth, frameHeight);

    const image = images.length ? images[i % images.length] : null;
    if (image) {
      // Imaginea umple cadrul („cover”), apoi primește o tentă sepia.
      const scale = Math.max(frameWidth / image.width, frameHeight / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, x + (frameWidth - w) / 2, frameY + (frameHeight - h) / 2, w, h);
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = 'rgba(190, 130, 70, 0.6)';
      ctx.fillRect(x, frameY, frameWidth, frameHeight);
      // O lumină caldă peste cadru, ca la o proiecție veche.
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 196, 120, 0.16)';
      ctx.fillRect(x, frameY, frameWidth, frameHeight);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Vinietă: colțurile cadrului mai întunecate, ca la fotografiile vechi.
    const cx = x + frameWidth / 2;
    const cy = frameY + frameHeight / 2;
    const vignette = ctx.createRadialGradient(cx, cy, frameHeight * 0.3, cx, cy, frameWidth * 0.68);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(25, 12, 0, 0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(x, frameY, frameWidth, frameHeight);
    ctx.restore();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, frameY, frameWidth, frameHeight, 10);
    ctx.stroke();

    // Marcajele de pe margine: numărul cadrului și „numele” peliculei.
    ctx.fillStyle = 'rgba(255, 168, 56, 0.85)';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('FILMOTECA 400', x + 8, frameY - 8);
    ctx.fillText(`▸ ${i + 1}`, x + 8, frameY + frameHeight + 17);
    ctx.fillText(`${i + 1}A`, x + frameWidth * 0.62, frameY + frameHeight + 17);
  }

  // Zgârieturi verticale și praf.
  for (let s = 0; s < 46; s += 1) {
    const x = random() * width;
    const y = random() * height * 0.5;
    ctx.strokeStyle = `rgba(255, 238, 210, ${0.08 + random() * 0.22})`;
    ctx.lineWidth = random() < 0.85 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 8, y + height * (0.2 + random() * 0.8));
    ctx.stroke();
  }
  for (let d = 0; d < 260; d += 1) {
    ctx.fillStyle = random() < 0.5 ? `rgba(255, 240, 220, ${0.15 + random() * 0.35})` : `rgba(0, 0, 0, ${0.2 + random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(random() * width, random() * height, 0.5 + random() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Granulație: fiecare pixel e puțin mai deschis sau mai închis.
  const pixels = ctx.getImageData(0, 0, width, height);
  for (let p = 0; p < pixels.data.length; p += 4) {
    const noise = (random() - 0.5) * 26;
    pixels.data[p] += noise;
    pixels.data[p + 1] += noise;
    pixels.data[p + 2] += noise;
  }
  ctx.putImageData(pixels, 0, 0);

  // Perforațiile: tăiate de tot (transparente), sus și jos.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (let x = (holePitch - 18) / 2; x < width; x += holePitch) {
    for (const y of [10, height - 10 - 22]) {
      ctx.beginPath();
      ctx.roundRect(x, y, 18, 22, 4);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// Pelicula ca textură. Cadrele rămân goale până se încarcă posterele.
function createFilmTexture(posterUrls, onReady) {
  const canvas = document.createElement('canvas');
  canvas.width = FILM.frames * FILM.cell;
  canvas.height = FILM.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  drawFilmStrip(ctx, []);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  if (posterUrls.length) {
    Promise.all(posterUrls.slice(0, FILM.frames).map(loadImage)).then((images) => {
      drawFilmStrip(ctx, images.filter(Boolean));
      texture.needsUpdate = true;
      onReady();
    });
  }
  return texture;
}

// Pelicula își are propria lumină (emissive), ca să nu se piardă pe fundalul închis.
// Perforațiile sunt transparente în textură, iar `alphaTest` le decupează de tot.
function filmMaterial(texture) {
  return new MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: '#ffffff',
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0,
    envMapIntensity: 0.6,
    alphaTest: 0.5,
    side: DoubleSide,
  });
}

// Banda: un cilindru deschis (fără capace), ușor ondulat, cu pelicula ca textură de jur împrejur.
function createFilmBand(scene, texture) {
  // Înălțimea benzii păstrează proporțiile texturii pe circumferința cercului (raza 1).
  const bandHeight = (2 * Math.PI * FILM.height) / (FILM.frames * FILM.cell);
  const geometry = new CylinderGeometry(1, 1, bandHeight, 180, 1, true);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const angle = Math.atan2(positions.getX(i), positions.getZ(i));
    positions.setY(i, positions.getY(i) + Math.sin(angle * 3) * 0.035);
  }

  const band = new Mesh(geometry, filmMaterial(texture));

  // Înclinarea orbitei: partea din față a benzii e mai jos și mai aproape de privitor.
  const group = new Group();
  group.rotation.set(0.38, 0, -0.12);
  group.add(band);
  scene.add(group);
  return { group, band };
}

// Panglica: pelicula întinsă de-a lungul unei curbe. Lățimea stă în planul ecranului, iar
// o răsucire lentă o întoarce din loc în loc pe muchie, ca pe o bandă de film adevărată.
// Textura se repetă pe lungime; mutarea ei face filmul să „ruleze”.
function createFilmRibbon(scene, texture, { width, samples = 480 }) {
  texture.wrapS = RepeatWrapping;
  const geometry = new BufferGeometry();
  const mesh = new Mesh(geometry, filmMaterial(texture));
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Cât de lungă e o tură completă a texturii (toate cadrele), pentru lățimea dată.
  const repeatLength = (width * FILM.frames * FILM.cell) / FILM.height;
  const point = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();

  const indices = [];
  for (let i = 0; i < samples; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  geometry.setIndex(indices);

  return {
    setPath(points) {
      const curve = new CatmullRomCurve3(points, false, 'centripetal');
      curve.arcLengthDivisions = 2000;
      const length = curve.getLength();
      const positions = new Float32Array((samples + 1) * 6);
      const uvs = new Float32Array((samples + 1) * 4);

      for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        curve.getPointAt(t, point);
        curve.getTangentAt(t, tangent);
        side.set(tangent.y, -tangent.x, 0).normalize();
        side.applyAxisAngle(tangent, Math.sin(t * Math.PI * 2.6) * 0.75);
        const u = (t * length) / repeatLength;
        // Marginea de jos (v = 0) și cea de sus (v = 1) a peliculei.
        positions.set(point.clone().addScaledVector(side, width / 2).toArray(), i * 6);
        positions.set(point.clone().addScaledVector(side, -width / 2).toArray(), i * 6 + 3);
        uvs.set([u, 0, u, 1], i * 4);
      }

      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();
    },

    // distance: câți pixeli a rulat filmul de-a lungul curbei.
    slide(distance) {
      texture.offset.x = -distance / repeatLength;
    },
  };
}

// ---------- Prima pagină ----------

export function startHomeScene({ canvas, stage, posterUrls }) {
  const small = isSmallScreen();

  createStage(canvas, ({ scene, still, invalidate }) => {
    // Sfera din mijloc: netedă, ca o perlă închisă la culoare, cu irizații fine.
    const sphere = new Mesh(
      new SphereGeometry(1, 96, 64),
      new MeshPhysicalMaterial({
        color: '#15151c',
        metalness: 0.9,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        iridescence: 0.7,
        iridescenceIOR: 1.6,
      }),
    );
    scene.add(sphere);

    // Două inele subțiri, chihlimbarii, în jurul sferei, ca orbitele unei planete.
    const ringMaterial = new MeshBasicMaterial({ color: '#d9a441', transparent: true, opacity: 0.45 });
    const rings = [new Mesh(new TorusGeometry(1, 0.006, 8, 160), ringMaterial), new Mesh(new TorusGeometry(1, 0.004, 8, 160), ringMaterial)];
    scene.add(...rings);

    const film = createFilmBand(scene, createFilmTexture(posterUrls, invalidate));

    return {
      layout(viewport) {
        const vw = viewport.width;
        const box = pageBox(stage);
        const radius = Math.min(box.width, box.height) * 0.27;
        const orbitRadius = Math.min(radius * 2.05, vw * (small ? 0.4 : 0.42));
        const center = new Vector3(box.centerX - vw / 2, -(box.top + box.height * 0.42), 0);

        sphere.position.copy(center);
        sphere.scale.setScalar(radius);
        rings[0].position.copy(center);
        rings[0].scale.setScalar(radius * 1.35);
        rings[0].rotation.set(Math.PI / 2 - 0.35, 0.15, 0);
        rings[1].position.copy(center);
        rings[1].scale.setScalar(radius * 2.6);
        rings[1].rotation.set(Math.PI / 2 - 0.2, -0.25, 0);

        film.group.position.copy(center);
        film.group.scale.setScalar(orbitRadius);
      },

      // Pelicula „rulează” în jurul sferei; scroll-ul o împinge puțin mai repede.
      update({ time, scrollY }) {
        if (still) return;
        sphere.rotation.y = time * 0.15;
        rings[0].rotation.z = time * 0.05;
        rings[1].rotation.z = -time * 0.035;
        film.band.rotation.y = -(time * 0.12 + scrollY * 0.0008);
      },
    };
  });
}

// ---------- Autentificare și cont nou ----------

// Pelicula intră din stânga sus, trece pe după formular, se întoarce larg pe dreapta,
// apoi pe stânga și iese în dreapta jos.
export function startAuthScene({ canvas, posterUrls }) {
  const small = isSmallScreen();
  createStage(canvas, ({ scene, still, invalidate }) => {
    const ribbon = createFilmRibbon(scene, createFilmTexture(posterUrls, invalidate), { width: small ? 70 : 112 });
    return {
      layout(viewport) {
        const vw = viewport.width;
        const height = Math.max(document.documentElement.scrollHeight, viewport.height);
        ribbon.setPath(
          [
            [-vw * 0.8, height * 0.1, -120],
            [-vw * 0.2, height * 0.24, 140],
            [vw * 0.28, height * 0.34, -100],
            [vw * 0.42, height * 0.5, 0],
            [vw * 0.1, height * 0.64, 140],
            [-vw * 0.3, height * 0.72, 40],
            [-vw * 0.26, height * 0.86, -80],
            [vw * 0.25, height * 0.93, -40],
            [vw * 0.85, height * 1.0, 0],
          ].map(toWorld),
        );
      },
      update({ time, scrollY }) {
        ribbon.slide(still ? 0 : scrollY * 0.6 + time * 40);
      },
    };
  });
}
