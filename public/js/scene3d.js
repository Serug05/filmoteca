// Grafica 3D (doar decor): un lanț cromat care trece prin toată pagina și alunecă la scroll,
// plus, pe prima pagină, o sferă din postere în jurul unei stele metalice.
// Lumina se schimbă după secțiunea din mijlocul ecranului (atributul data-band): albă, roșie, cyan.
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from '/vendor/three/three.module.js';

const LIGHTS = {
  white: new Color('#ffffff'),
  red: new Color('#ff4655'),
  cyan: new Color('rgb(80, 220, 255)'),
};
const UP = new Vector3(0, 1, 0);
const FOV = 35;
const FRAME_SAMPLES = 600;

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

// Poziția unui element în pagină (nu pe ecran): sus, jos, centru.
function pageBox(element) {
  const rect = element.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  return { top, bottom: top + rect.height, height: rect.height, centerX: rect.left + rect.width / 2, width: rect.width };
}

// Un „studio” virtual: o cameră gri cu panouri luminoase. Cromul lanțului îl reflectă;
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

// O za: un tor (inel) întins pe verticală. Toate zalele sunt desenate dintr-o dată (InstancedMesh).
function createChain(linkSize, maxLinks) {
  const geometry = new TorusGeometry(0.5, 0.13, 12, 36);
  geometry.scale(linkSize, linkSize * 1.6, linkSize);
  const material = new MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.2, emissive: '#000000' });
  const chain = new InstancedMesh(geometry, material, maxLinks);
  chain.frustumCulled = false;
  // Distanța dintre zale e puțin mai mică decât golul din interiorul unei zale, ca să se prindă.
  return { mesh: chain, material, pitch: linkSize * 1.05 };
}

// Sfera de postere din prima pagină, cu o stea metalică în centru. Construită pe raza 1,
// apoi mărită la dimensiunea zonei din pagină.
function createPosterSphere(posterUrls, tiles) {
  const group = new Group();
  const loader = new TextureLoader();
  const materials = posterUrls.map((url) => {
    const texture = loader.load(url);
    texture.colorSpace = SRGBColorSpace;
    return new MeshBasicMaterial({ map: texture, side: DoubleSide });
  });

  const tileGeometry = new PlaneGeometry(0.38, 0.57);
  const direction = new Vector3();
  for (let i = 0; i < tiles; i += 1) {
    const y = 1 - ((i + 0.5) * 2) / tiles;
    const ring = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    direction.set(Math.cos(angle) * ring, y, Math.sin(angle) * ring);

    const tile = new Mesh(tileGeometry, materials[i % materials.length]);
    tile.position.copy(direction);
    tile.lookAt(direction.clone().multiplyScalar(2));
    group.add(tile);
  }

  const metal = new MeshStandardMaterial({ color: '#141418', metalness: 1, roughness: 0.25 });
  const core = new IcosahedronGeometry(0.26, 0);
  group.add(new Mesh(core, metal));

  const spike = new ConeGeometry(0.06, 0.42, 8);
  const vertex = new Vector3();
  const seen = new Set();
  const positions = core.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i).normalize();
    const key = vertex.toArray().map((n) => n.toFixed(3)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const cone = new Mesh(spike, metal);
    cone.position.copy(vertex).multiplyScalar(0.36);
    cone.quaternion.setFromUnitVectors(UP, vertex);
    group.add(cone);
  }
  return group;
}

// Motorul comun: randare, cameră care urmărește scroll-ul, lanțul și culoarea luminii.
function createStage(canvas, { path, sphere, linkSize, maxLinks, driftPerSecond, scrollPull }) {
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

  const camera = new PerspectiveCamera(FOV, 1, 1, 6000);
  const chain = createChain(linkSize, maxLinks);
  scene.add(chain.mesh);
  if (sphere) scene.add(sphere.group);

  const still = reducedMotion();
  const tint = new Color('#ffffff');
  let bands = [];
  const point = new Vector3();
  const basis = new Matrix4();
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const quarterTurn = new Quaternion().setFromAxisAngle(UP, Math.PI / 2);
  const unit = new Vector3(1, 1, 1);

  let curve = null;
  let frames = null;
  let length = 1;
  let links = 0;
  let viewport = { width: 1, height: 1 };
  let elapsed = 0;

  // Coordonatele 3D sunt pixeli din pagină: x față de mijlocul ecranului, y în jos devine y negativ.
  function layout() {
    viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen() ? 1 : 1.75));
    renderer.setSize(viewport.width, viewport.height, false);
    camera.aspect = viewport.width / viewport.height;
    camera.position.z = viewport.height / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.updateProjectionMatrix();

    const points = path(viewport).map(([x, y, z]) => new Vector3(x, -y, z));
    curve = new CatmullRomCurve3(points, false, 'centripetal');
    curve.arcLengthDivisions = 2000;
    length = curve.getLength();
    frames = curve.computeFrenetFrames(FRAME_SAMPLES, false);
    links = Math.min(maxLinks, Math.ceil(length / chain.pitch));
    bands = [...document.querySelectorAll('[data-band]')].map((element) => ({
      box: pageBox(element),
      color: LIGHTS[element.dataset.band] ?? LIGHTS.white,
    }));
    if (sphere) sphere.layout(viewport);
  }

  // Culoarea luminii: a secțiunii aflate în mijlocul ecranului.
  function bandColor() {
    const middle = window.scrollY + viewport.height / 2;
    return bands.find(({ box }) => middle >= box.top && middle < box.bottom)?.color ?? LIGHTS.white;
  }

  function update(delta) {
    elapsed += delta;
    camera.position.set(0, -(window.scrollY + viewport.height / 2), camera.position.z);

    // Scroll-ul „trage” de lanț: zalele alunecă de-a lungul curbei.
    const offset = still ? 0 : ((window.scrollY * scrollPull + elapsed * driftPerSecond) / length) % 1;
    for (let i = 0; i < links; i += 1) {
      const t = (i / links + offset) % 1;
      const frame = Math.round(t * FRAME_SAMPLES);
      curve.getPointAt(t, point);
      // Axa lungă a zalei (y) urmează curba. Ordinea (binormală, tangentă, normală) dă o rotație
      // corectă; cu (normală, tangentă, binormală) baza ar fi în oglindă.
      basis.makeBasis(frames.binormals[frame], frames.tangents[frame], frames.normals[frame]);
      quaternion.setFromRotationMatrix(basis);
      // Fiecare a doua za e rotită cu 90°, ca zalele să se prindă una de alta.
      if (i % 2) quaternion.multiply(quarterTurn);
      matrix.compose(point, quaternion, unit);
      chain.mesh.setMatrixAt(i, matrix);
    }
    chain.mesh.count = links;
    chain.mesh.instanceMatrix.needsUpdate = true;

    tint.lerp(bandColor(), still ? 1 : Math.min(1, delta * 4));
    // Cromul preia culoarea secțiunii: reflexiile sunt colorate, iar o strălucire slabă o întărește.
    chain.material.color.copy(tint);
    chain.material.emissive.copy(tint).multiplyScalar(0.08);
    keyLight.color.copy(tint);
    if (sphere && !still) sphere.animate(delta, window.scrollY);
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

// Prima pagină: lanțul înconjoară sfera de postere din hero, apoi coboară prin toate secțiunile.
export function startHomeScene({ canvas, stage, posterUrls }) {
  const small = isSmallScreen();
  const group = createPosterSphere(posterUrls, small ? 24 : 36);
  let radius = 1;

  const sphere = {
    group,
    layout(viewport) {
      const box = pageBox(stage);
      radius = Math.min(box.width, box.height) * 0.36;
      group.position.set(box.centerX - viewport.width / 2, -(box.top + box.height / 2), 0);
      group.scale.setScalar(radius);
    },
    animate(delta, scrollY) {
      group.rotation.y += delta * 0.25;
      group.rotation.x = 0.25 + scrollY * 0.0006;
    },
  };

  const sections = () => [...document.querySelectorAll('[data-band]')].map(pageBox);

  function path(viewport) {
    const vw = viewport.width;
    const [hero, ranking, catalog, final] = sections();
    const box = pageBox(stage);
    const cx = box.centerX - vw / 2;
    const cy = box.top + box.height / 2;
    const r = Math.min(box.width, box.height) * 0.36;
    return [
      [-vw * 0.8, hero.top + hero.height * 0.1, -150],
      [-vw * 0.32, cy - r * 1.6, 120],
      [cx - r * 1.35, cy - r * 0.15, 220],
      [cx - r * 0.2, cy - r * 0.8, -260],
      [cx + r * 1.3, cy - r * 0.25, -60],
      [cx + r * 0.6, cy + r * 0.85, 260],
      [cx - r * 0.9, cy + r * 0.6, 180],
      [-vw * 0.38, ranking.top + ranking.height * 0.15, -40],
      [vw * 0.42, ranking.top + ranking.height * 0.6, 80],
      [vw * 0.44, catalog.top + 140, -60],
      [-vw * 0.46, catalog.top + catalog.height * 0.5, 100],
      [-vw * 0.22, final.top + final.height * 0.3, 160],
      [vw * 0.3, final.top + final.height * 0.75, -80],
      [vw * 0.85, final.bottom + 160, 0],
    ];
  }

  createStage(canvas, {
    path,
    sphere,
    linkSize: small ? 20 : 34,
    maxLinks: 400,
    driftPerSecond: 14,
    scrollPull: 0.6,
  });
}

// Autentificare și cont nou: doar lanțul, pe diagonală, în spatele formularului.
export function startAuthScene({ canvas }) {
  const small = isSmallScreen();
  createStage(canvas, {
    path(viewport) {
      const vw = viewport.width;
      const height = Math.max(document.documentElement.scrollHeight, viewport.height);
      return [
        [-vw * 0.8, height * 0.12, -120],
        [-vw * 0.15, height * 0.28, 160],
        [vw * 0.32, height * 0.42, -140],
        [-vw * 0.25, height * 0.68, 140],
        [vw * 0.2, height * 0.86, -60],
        [vw * 0.85, height * 0.98, 0],
      ];
    },
    sphere: null,
    linkSize: small ? 20 : 32,
    maxLinks: 200,
    driftPerSecond: 40,
    scrollPull: 0.6,
  });
}
